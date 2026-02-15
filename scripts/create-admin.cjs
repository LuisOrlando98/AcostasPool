/* eslint-disable @typescript-eslint/no-require-imports */
const readline = require("readline");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function promptText(rl, question, { required = true, defaultValue = "" } = {}) {
  return new Promise((resolve) => {
    const ask = () => {
      const suffix = defaultValue ? ` [${defaultValue}]` : "";
      rl.question(`${question}${suffix}: `, (raw) => {
        const value = raw.trim() || defaultValue;
        if (required && !value) {
          console.log("Este campo es obligatorio.");
          ask();
          return;
        }
        resolve(value);
      });
    };
    ask();
  });
}

function promptHidden(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise((resolve) => {
    const originalWrite = rl._writeToOutput;
    rl.stdoutMuted = true;
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (!rl.stdoutMuted) {
        originalWrite.call(rl, stringToWrite);
        return;
      }
      if (stringToWrite.startsWith(`${question}:`)) {
        originalWrite.call(rl, stringToWrite);
        return;
      }
      originalWrite.call(rl, "*");
    };

    rl.question(`${question}: `, (value) => {
      rl.stdoutMuted = false;
      rl._writeToOutput = originalWrite;
      rl.close();
      console.log("");
      resolve(value.trim());
    });
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("Create Admin User");
    console.log("-----------------");

    const email = await promptText(rl, "Email admin");
    if (!isValidEmail(email)) {
      throw new Error("Email invalido.");
    }

    const fullName = await promptText(rl, "Nombre completo", {
      required: false,
      defaultValue: "Administrador Principal",
    });

    const password = await promptHidden("Password");
    const passwordConfirm = await promptHidden("Confirmar password");

    if (!password) {
      throw new Error("Password requerido.");
    }
    if (password.length < 10) {
      throw new Error("Password debe tener al menos 10 caracteres.");
    }
    if (password !== passwordConfirm) {
      throw new Error("Las passwords no coinciden.");
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (existing) {
      const answer = await promptText(rl, "El usuario ya existe. Actualizar a ADMIN y resetear password? (y/N)", {
        required: false,
        defaultValue: "N",
      });

      if (!["y", "yes", "s", "si"].includes(answer.toLowerCase())) {
        console.log("Sin cambios.");
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        fullName,
        passwordHash,
        role: "ADMIN",
        locale: "ES",
        isActive: true,
      },
      update: {
        fullName,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });

    console.log(`Admin creado/actualizado: ${user.email}`);
    console.log(`User ID: ${user.id}`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error:", error.message ?? error);
  process.exit(1);
});

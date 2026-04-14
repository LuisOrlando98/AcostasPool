param(
  [string]$FinancialPath = "C:\Users\Luis_HOME\Downloads\Ficha de Clientes Financiero(Hoja1).csv",
  [string]$InfoPath = "C:\Users\Luis_HOME\Downloads\info de clientes.csv",
  [string]$OutputPath = "C:\Users\Luis_HOME\acostaspool\artifacts\customer-import-review-2026-04-13.xlsx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Remove-Diacritics {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return ""
  }

  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($char in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  return $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function Normalize-Whitespace {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return (($Value -replace "\s+", " ").Trim())
}

function Normalize-Name {
  param([string]$Value)

  $clean = Normalize-Whitespace (Remove-Diacritics $Value).ToLowerInvariant()
  $clean = ($clean -replace "[^a-z0-9 ]", " ")
  return Normalize-Whitespace $clean
}

function Get-Tokens {
  param([string]$Value)

  $normalized = Normalize-Name $Value
  if ([string]::IsNullOrWhiteSpace($normalized)) {
    return ,@()
  }
  return ,@($normalized.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries))
}

function Get-AlphaBase {
  param([string]$Value)

  $tokens = Get-Tokens $Value
  if ($tokens.Count -eq 0) {
    return ""
  }

  $alpha = New-Object System.Collections.Generic.List[string]
  foreach ($token in $tokens) {
    if ($token -match "^\d+$") {
      break
    }
    [void]$alpha.Add($token)
  }

  if ($alpha.Count -eq 0) {
    return $tokens[0]
  }

  return ($alpha -join " ")
}

function Get-CommonPrefixRatio {
  param(
    [string]$Left,
    [string]$Right
  )

  if ([string]::IsNullOrWhiteSpace($Left) -or [string]::IsNullOrWhiteSpace($Right)) {
    return 0.0
  }

  $maxLength = [Math]::Max($Left.Length, $Right.Length)
  $prefixLength = 0
  $limit = [Math]::Min($Left.Length, $Right.Length)
  for ($index = 0; $index -lt $limit; $index++) {
    if ($Left[$index] -ne $Right[$index]) {
      break
    }
    $prefixLength++
  }

  if ($maxLength -eq 0) {
    return 0.0
  }

  return [Math]::Round(($prefixLength / $maxLength), 4)
}

function Get-MatchScore {
  param(
    [string]$Left,
    [string]$Right
  )

  $leftNormalized = Normalize-Name $Left
  $rightNormalized = Normalize-Name $Right

  if (-not $leftNormalized -or -not $rightNormalized) {
    return 0.0
  }

  if ($leftNormalized -eq $rightNormalized) {
    return 1.0
  }

  $leftBase = Get-AlphaBase $Left
  $rightBase = Get-AlphaBase $Right

  if ($leftBase -and $leftBase -eq $rightBase) {
    return 0.9
  }

  if ($leftNormalized.StartsWith("$rightNormalized ") -or $rightNormalized.StartsWith("$leftNormalized ")) {
    return 0.84
  }

  $leftTokens = @(Get-Tokens $Left)
  $rightTokens = @(Get-Tokens $Right)
  $leftSet = New-Object "System.Collections.Generic.HashSet[string]"
  $rightSet = New-Object "System.Collections.Generic.HashSet[string]"
  foreach ($token in $leftTokens) { [void]$leftSet.Add($token) }
  foreach ($token in $rightTokens) { [void]$rightSet.Add($token) }

  $intersection = 0
  foreach ($token in $leftSet) {
    if ($rightSet.Contains($token)) {
      $intersection++
    }
  }

  $union = ($leftSet.Count + $rightSet.Count - $intersection)
  $jaccard = if ($union -gt 0) { $intersection / $union } else { 0.0 }
  $prefixRatio = Get-CommonPrefixRatio $leftNormalized $rightNormalized

  return [Math]::Round(($jaccard * 0.7) + ($prefixRatio * 0.3), 4)
}

function Normalize-Phone {
  param([string]$Value)

  $raw = if ($null -eq $Value) { "" } else { [string]$Value }
  $digits = ($raw -replace "\D", "")
  if ($digits.Length -eq 11 -and $digits.StartsWith("1")) {
    $digits = $digits.Substring(1)
  }
  if ($digits.Length -ne 10) {
    return ""
  }
  return "+1 ({0})-{1}-{2}" -f $digits.Substring(0, 3), $digits.Substring(3, 3), $digits.Substring(6, 4)
}

function Extract-PrimaryEmail {
  param([string]$Value)

  $original = Normalize-Whitespace $Value
  if (-not $original) {
    return [pscustomobject]@{
      Primary = ""
      Original = ""
      Note = ""
    }
  }

  $matches = [regex]::Matches($original.ToLowerInvariant(), "[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}")
  $emails = New-Object System.Collections.Generic.List[string]
  foreach ($match in $matches) {
    if (-not $emails.Contains($match.Value)) {
      [void]$emails.Add($match.Value)
    }
  }

  if ($emails.Count -eq 0) {
    return [pscustomobject]@{
      Primary = ""
      Original = $original
      Note = "No se detecto un email valido."
    }
  }

  $note = if ($emails.Count -gt 1) {
    "Se detectaron multiples emails; se dejo el primero para revision."
  } else {
    ""
  }

  return [pscustomobject]@{
    Primary = $emails[0]
    Original = $original
    Note = $note
  }
}

function Parse-StartDate {
  param([string]$Value)

  $raw = Normalize-Whitespace $Value
  if (-not $raw) {
    return ""
  }

  $formats = @("d-MMM-yy", "dd-MMM-yy")
  foreach ($format in $formats) {
    try {
      $parsed = [DateTime]::ParseExact(
        $raw,
        $format,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::None
      )
      return $parsed.ToString("yyyy-MM-dd")
    } catch {
    }
  }

  return $raw
}

function Normalize-PaymentType {
  param([string]$Value)

  $normalized = Normalize-Name $Value
  switch ($normalized) {
    "x trabajar" { return "TO_WORK" }
    "por trabajar" { return "TO_WORK" }
    "trabajado" { return "WORKED" }
    default { return "" }
  }
}

function Split-ClientName {
  param([string]$Value)

  $clean = Normalize-Whitespace $Value
  if (-not $clean) {
    return [pscustomobject]@{
      Full = ""
      First = ""
      Last = ""
    }
  }

  $parts = @($clean.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries))
  if ($parts.Count -le 1) {
    return [pscustomobject]@{
      Full = $clean
      First = $clean
      Last = ""
    }
  }

  return [pscustomobject]@{
    Full = $clean
    First = $parts[0]
    Last = ($parts[1..($parts.Count - 1)] -join " ")
  }
}

function Build-AccessNotes {
  param(
    [string]$Entry,
    [string]$Notes
  )

  $parts = New-Object System.Collections.Generic.List[string]
  $entryClean = Normalize-Whitespace $Entry
  $notesClean = Normalize-Whitespace $Notes

  if ($entryClean) {
    [void]$parts.Add("Entrada: $entryClean")
  }
  if ($notesClean) {
    [void]$parts.Add($notesClean)
  }

  return ($parts -join " | ")
}

function Build-PaymentNotes {
  param([string]$Zelle)

  $clean = Normalize-Whitespace $Zelle
  if (-not $clean) {
    return ""
  }

  return "Zelle: $clean"
}

function Get-Suggestions {
  param(
    [pscustomobject]$Source,
    [object[]]$Targets
  )

  $results = foreach ($target in $Targets) {
    $score = Get-MatchScore $Source.ClientName $target.ClientName
    if ($score -ge 0.45) {
      [pscustomobject]@{
        Target = $target
        Name = $target.ClientName
        Score = [Math]::Round($score, 2)
      }
    }
  }

  return @(
    $results |
      Sort-Object @{ Expression = "Score"; Descending = $true }, @{ Expression = "Name"; Descending = $false } |
      Select-Object -First 3
  )
}

function Get-SuggestionType {
  param([object[]]$Suggestions)

  $items = @(
    $Suggestions |
      Where-Object {
        $null -ne $_ -and $_.PSObject -and $_.PSObject.Properties["Score"]
      }
  )

  if ($items.Count -eq 0) {
    return "NONE"
  }

  $top = [double]$items[0].Score
  $second = if ($items.Count -gt 1) { [double]$items[1].Score } else { 0.0 }

  if ($top -ge 0.82 -and $second -lt 0.78) {
    return "SINGLE"
  }

  if ($top -ge 0.75 -and $second -ge 0.75) {
    return "MULTI"
  }

  return "WEAK"
}

function Get-ReviewOrder {
  param([string]$Status)

  switch ($Status) {
    "EXACT" { return 1 }
    "REVIEW_SINGLE_SUGGESTION" { return 2 }
    "REVIEW_MULTI_CANDIDATE" { return 3 }
    "REVIEW_FINANCIAL_ONLY" { return 4 }
    "REVIEW_INFO_ONLY" { return 5 }
    default { return 9 }
  }
}

function New-MasterRow {
  param(
    [string]$MergeStatus,
    [string]$SourceSide,
    [pscustomobject]$FinancialRecord,
    [pscustomobject]$InfoRecord,
    [double]$MatchScore = 0.0,
    [object[]]$Suggestions = @(),
    [string]$ReviewNotes = ""
)

  $safeSuggestions = @(
    $Suggestions |
      Where-Object {
        $null -ne $_ -and $_.PSObject -and $_.PSObject.Properties["Name"] -and $_.PSObject.Properties["Score"]
      }
  )
  $finalName = if ($InfoRecord) { $InfoRecord.ClientName } elseif ($FinancialRecord) { $FinancialRecord.ClientName } else { "" }
  $nameParts = Split-ClientName $finalName
  $emailData = if ($InfoRecord) { Extract-PrimaryEmail $InfoRecord.EmailRaw } else {
    [pscustomobject]@{
      Primary = ""
      Original = ""
      Note = ""
    }
  }

  $notes = New-Object System.Collections.Generic.List[string]
  if ($ReviewNotes) {
    [void]$notes.Add($ReviewNotes)
  }
  if ($emailData.Note) {
    [void]$notes.Add($emailData.Note)
  }

  $propertyAddress = if ($InfoRecord) { Normalize-Whitespace $InfoRecord.AddressRaw } else { "" }
  $accessLocationNotes = if ($InfoRecord) { Build-AccessNotes $InfoRecord.EntryRaw $InfoRecord.InfoNotesRaw } else { "" }
  $paymentNotes = if ($FinancialRecord) { Build-PaymentNotes $FinancialRecord.ZelleRaw } else { "" }

  [pscustomobject]@{
    review_order = Get-ReviewOrder $MergeStatus
    merge_status = $MergeStatus
    source_side = $SourceSide
    existing_export_check = "PENDING_REAL_EXPORT"
    match_score = if ($MatchScore -gt 0) { [Math]::Round($MatchScore, 2) } else { "" }
    financial_name = if ($FinancialRecord) { $FinancialRecord.ClientName } else { "" }
    info_name = if ($InfoRecord) { $InfoRecord.ClientName } else { "" }
    suggested_match_1 = if ($safeSuggestions.Count -gt 0) { $safeSuggestions[0].Name } else { "" }
    suggested_score_1 = if ($safeSuggestions.Count -gt 0) { $safeSuggestions[0].Score } else { "" }
    suggested_match_2 = if ($safeSuggestions.Count -gt 1) { $safeSuggestions[1].Name } else { "" }
    suggested_score_2 = if ($safeSuggestions.Count -gt 1) { $safeSuggestions[1].Score } else { "" }
    cliente_full_name = $nameParts.Full
    nombre = $nameParts.First
    apellidos = $nameParts.Last
    email = $emailData.Primary
    email_original = $emailData.Original
    telefono = if ($InfoRecord) { Normalize-Phone $InfoRecord.PhoneRaw } else { "" }
    telefono_original = if ($InfoRecord) { Normalize-Whitespace $InfoRecord.PhoneRaw } else { "" }
    idiomaPreferencia = "ES"
    estadoCuenta = "ACTIVE"
    tipoCliente = "RESIDENTIAL"
    allowWeekendBooking = "FALSE"
    customer_notas = ""
    property_name = ""
    property_address = $propertyAddress
    sanitizerType = if ($InfoRecord) { Normalize-Whitespace $InfoRecord.ChemicalRaw } else { "" }
    filterType = ""
    hasSpa = "FALSE"
    accessLocationNotes = $accessLocationNotes
    serviceStartDate = if ($FinancialRecord) { Parse-StartDate $FinancialRecord.StartDateRaw } else { "" }
    paymentDay = if ($FinancialRecord) { Normalize-Whitespace $FinancialRecord.PaymentDayRaw } else { "" }
    servicePrice = if ($FinancialRecord) { Normalize-Whitespace $FinancialRecord.PriceRaw } else { "" }
    paymentType = if ($FinancialRecord) { Normalize-PaymentType $FinancialRecord.PaymentTypeRaw } else { "" }
    paymentNotes = $paymentNotes
    zelle = if ($FinancialRecord) { Normalize-Whitespace $FinancialRecord.ZelleRaw } else { "" }
    quimico_raw = if ($InfoRecord) { Normalize-Whitespace $InfoRecord.ChemicalRaw } else { "" }
    entrada_raw = if ($InfoRecord) { Normalize-Whitespace $InfoRecord.EntryRaw } else { "" }
    notas_info_raw = if ($InfoRecord) { Normalize-Whitespace $InfoRecord.InfoNotesRaw } else { "" }
    source_fin_row = if ($FinancialRecord) { $FinancialRecord.RowNumber } else { "" }
    source_info_row = if ($InfoRecord) { $InfoRecord.RowNumber } else { "" }
    review_notes = ($notes -join " | ")
  }
}

function Write-Worksheet {
  param(
    $Workbook,
    [string]$SheetName,
    [object[]]$Rows,
    [string[]]$Columns,
    [string[]]$WrapColumns = @()
  )

  $worksheet = $Workbook.Worksheets.Add()
  $worksheet.Name = $SheetName

  for ($columnIndex = 0; $columnIndex -lt $Columns.Count; $columnIndex++) {
    $worksheet.Cells.Item(1, $columnIndex + 1) = $Columns[$columnIndex]
  }

  for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
    $row = $Rows[$rowIndex]
    for ($columnIndex = 0; $columnIndex -lt $Columns.Count; $columnIndex++) {
      $value = $row.($Columns[$columnIndex])
      $worksheet.Cells.Item($rowIndex + 2, $columnIndex + 1) = if ($null -eq $value) { "" } else { [string]$value }
    }
  }

  $headerRange = $worksheet.Range($worksheet.Cells.Item(1, 1), $worksheet.Cells.Item(1, $Columns.Count))
  $headerRange.Font.Bold = $true
  $headerRange.Interior.Color = 0xD9EAF7
  $headerRange.AutoFilter() | Out-Null

  $worksheet.Application.ActiveWindow.SplitRow = 1
  $worksheet.Application.ActiveWindow.FreezePanes = $true
  $worksheet.UsedRange.EntireColumn.AutoFit() | Out-Null

  foreach ($columnName in $WrapColumns) {
    $columnPosition = [Array]::IndexOf($Columns, $columnName)
    if ($columnPosition -ge 0) {
      $worksheet.Columns.Item($columnPosition + 1).WrapText = $true
      $worksheet.Columns.Item($columnPosition + 1).ColumnWidth = [Math]::Min([Math]::Max($worksheet.Columns.Item($columnPosition + 1).ColumnWidth, 20), 42)
    }
  }

  return $worksheet
}

if (-not (Test-Path $FinancialPath)) {
  throw "No se encontro el archivo financiero: $FinancialPath"
}

if (-not (Test-Path $InfoPath)) {
  throw "No se encontro el archivo de info: $InfoPath"
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDirectory)) {
  [void](New-Item -ItemType Directory -Path $outputDirectory -Force)
}

$financialRaw = @(Import-Csv $FinancialPath)
$infoRaw = @(Import-Csv $InfoPath)

$financial = for ($index = 0; $index -lt $financialRaw.Count; $index++) {
  $row = $financialRaw[$index]
  [pscustomobject]@{
    RowNumber = $index + 2
    ClientName = Normalize-Whitespace $row.CLIENTE
    StartDateRaw = Normalize-Whitespace $row.'FECHA DE INICIO'
    PaymentDayRaw = Normalize-Whitespace $row.'DIA DE COBRO'
    PriceRaw = Normalize-Whitespace $row.PRECIO
    PaymentTypeRaw = Normalize-Whitespace $row.'TIPO DE PAGO'
    ZelleRaw = Normalize-Whitespace $row.ZELLE
    NormalizedName = Normalize-Name $row.CLIENTE
  }
}

$blankFinancialRows = @($financial | Where-Object { -not $_.ClientName })
$financial = @($financial | Where-Object { $_.ClientName })

$info = for ($index = 0; $index -lt $infoRaw.Count; $index++) {
  $row = $infoRaw[$index]
  [pscustomobject]@{
    RowNumber = $index + 2
    ClientName = Normalize-Whitespace $row.CLIENTE
    AddressRaw = Normalize-Whitespace $row.Direccion
    PhoneRaw = Normalize-Whitespace $row.TELEFONO
    EmailRaw = Normalize-Whitespace $row.'Correo Electronico'
    ChemicalRaw = Normalize-Whitespace $row.QUIMICO
    EntryRaw = Normalize-Whitespace $row.ENTRADA
    InfoNotesRaw = Normalize-Whitespace $row.NOTAS
    NormalizedName = Normalize-Name $row.CLIENTE
  }
}

$info = @($info | Where-Object { $_.ClientName })

$infoByName = @{}
foreach ($record in $info) {
  if (-not $infoByName.ContainsKey($record.NormalizedName)) {
    $infoByName[$record.NormalizedName] = New-Object System.Collections.Generic.List[object]
  }
  $infoByName[$record.NormalizedName].Add($record)
}

$usedInfoRows = New-Object "System.Collections.Generic.HashSet[int]"
$exactMatches = New-Object System.Collections.Generic.List[object]
$unmatchedFinancial = New-Object System.Collections.Generic.List[object]

foreach ($financialRecord in $financial) {
  if ($infoByName.ContainsKey($financialRecord.NormalizedName)) {
    $available = @($infoByName[$financialRecord.NormalizedName] | Where-Object { -not $usedInfoRows.Contains($_.RowNumber) })
    if ($available.Count -gt 0) {
      $matchedInfo = $available[0]
      [void]$usedInfoRows.Add($matchedInfo.RowNumber)
      $exactMatches.Add([pscustomobject]@{
        Financial = $financialRecord
        Info = $matchedInfo
      })
      continue
    }
  }

  $unmatchedFinancial.Add($financialRecord)
}

$unmatchedInfo = @($info | Where-Object { -not $usedInfoRows.Contains($_.RowNumber) })

$masterRows = New-Object System.Collections.Generic.List[object]
foreach ($pair in $exactMatches) {
  $masterRows.Add((New-MasterRow -MergeStatus "EXACT" -SourceSide "MERGED" -FinancialRecord $pair.Financial -InfoRecord $pair.Info -MatchScore 1.0))
}

foreach ($financialRecord in $unmatchedFinancial) {
  $suggestions = @(Get-Suggestions -Source $financialRecord -Targets $unmatchedInfo)
  $suggestionType = Get-SuggestionType $suggestions
  $status = switch ($suggestionType) {
    "SINGLE" { "REVIEW_SINGLE_SUGGESTION" }
    "MULTI" { "REVIEW_MULTI_CANDIDATE" }
    default { "REVIEW_FINANCIAL_ONLY" }
  }

  $notes = switch ($suggestionType) {
    "SINGLE" { "Sugerencia unica detectada; confirmar antes del import." }
    "MULTI" { "Hay multiples candidatos posibles; requiere decision manual." }
    default { "Solo existe en financiero; falta confirmar datos operativos." }
  }

  $masterRows.Add((New-MasterRow -MergeStatus $status -SourceSide "FINANCIAL" -FinancialRecord $financialRecord -InfoRecord $null -Suggestions $suggestions -ReviewNotes $notes))
}

foreach ($infoRecord in $unmatchedInfo) {
  $suggestions = @(Get-Suggestions -Source $infoRecord -Targets $unmatchedFinancial)
  $suggestionType = Get-SuggestionType $suggestions
  $status = switch ($suggestionType) {
    "SINGLE" { "REVIEW_SINGLE_SUGGESTION" }
    "MULTI" { "REVIEW_MULTI_CANDIDATE" }
    default { "REVIEW_INFO_ONLY" }
  }

  $notes = switch ($suggestionType) {
    "SINGLE" { "Sugerencia unica detectada; confirmar antes del import." }
    "MULTI" { "Hay multiples candidatos posibles; requiere decision manual." }
    default { "Solo existe en info operativa; falta confirmar datos financieros." }
  }

  $masterRows.Add((New-MasterRow -MergeStatus $status -SourceSide "INFO" -FinancialRecord $null -InfoRecord $infoRecord -Suggestions $suggestions -ReviewNotes $notes))
}

$masterRows = @(
  $masterRows |
    Sort-Object review_order, cliente_full_name, financial_name, info_name
)

$reviewNeededRows = @($masterRows | Where-Object { $_.merge_status -ne "EXACT" })
$summaryRows = @(
  [pscustomobject]@{ section = "Fuentes"; metric = "Archivo financiero"; value = $FinancialPath },
  [pscustomobject]@{ section = "Fuentes"; metric = "Archivo info"; value = $InfoPath },
  [pscustomobject]@{ section = "Salida"; metric = "Workbook"; value = $OutputPath },
  [pscustomobject]@{ section = "Conteo"; metric = "Filas financiero (raw)"; value = $financialRaw.Count },
  [pscustomobject]@{ section = "Conteo"; metric = "Filas financiero vacias omitidas"; value = $blankFinancialRows.Count },
  [pscustomobject]@{ section = "Conteo"; metric = "Filas financiero utiles"; value = $financial.Count },
  [pscustomobject]@{ section = "Conteo"; metric = "Filas info utiles"; value = $info.Count },
  [pscustomobject]@{ section = "Conciliacion"; metric = "Matches exactos"; value = @($masterRows | Where-Object { $_.merge_status -eq "EXACT" }).Count },
  [pscustomobject]@{ section = "Conciliacion"; metric = "Revision necesaria"; value = $reviewNeededRows.Count },
  [pscustomobject]@{ section = "Conciliacion"; metric = "Sugerencia unica"; value = @($masterRows | Where-Object { $_.merge_status -eq "REVIEW_SINGLE_SUGGESTION" }).Count },
  [pscustomobject]@{ section = "Conciliacion"; metric = "Multiples candidatos"; value = @($masterRows | Where-Object { $_.merge_status -eq "REVIEW_MULTI_CANDIDATE" }).Count },
  [pscustomobject]@{ section = "Conciliacion"; metric = "Solo financiero"; value = @($masterRows | Where-Object { $_.merge_status -eq "REVIEW_FINANCIAL_ONLY" }).Count },
  [pscustomobject]@{ section = "Conciliacion"; metric = "Solo info"; value = @($masterRows | Where-Object { $_.merge_status -eq "REVIEW_INFO_ONLY" }).Count },
  [pscustomobject]@{ section = "Supuestos"; metric = "idiomaPreferencia"; value = "ES" },
  [pscustomobject]@{ section = "Supuestos"; metric = "estadoCuenta"; value = "ACTIVE" },
  [pscustomobject]@{ section = "Supuestos"; metric = "tipoCliente"; value = "RESIDENTIAL" },
  [pscustomobject]@{ section = "Supuestos"; metric = "allowWeekendBooking"; value = "FALSE" },
  [pscustomobject]@{ section = "Export actual"; metric = "Estado"; value = "PENDIENTE" },
  [pscustomobject]@{ section = "Export actual"; metric = "Motivo"; value = "No hay DATABASE_URL local y el endpoint publico https://acostaspool.com/api/admin/developer/customers-transfer/export respondio 404 el 2026-04-13." },
  [pscustomobject]@{ section = "Export actual"; metric = "Impacto"; value = "No se pudo validar conflicto contra clientes ya existentes; esta revision cubre solo la consolidacion de los 2 CSV." }
)

$financialSheetRows = for ($index = 0; $index -lt $financialRaw.Count; $index++) {
  $row = $financialRaw[$index]
  [pscustomobject]@{
    source_row = $index + 2
    CLIENTE = $row.CLIENTE
    FECHA_DE_INICIO = $row.'FECHA DE INICIO'
    DIA_DE_COBRO = $row.'DIA DE COBRO'
    PRECIO = $row.PRECIO
    TIPO_DE_PAGO = $row.'TIPO DE PAGO'
    ZELLE = $row.ZELLE
  }
}

$infoSheetRows = for ($index = 0; $index -lt $infoRaw.Count; $index++) {
  $row = $infoRaw[$index]
  [pscustomobject]@{
    source_row = $index + 2
    CLIENTE = $row.CLIENTE
    Direccion = $row.Direccion
    TELEFONO = $row.TELEFONO
    Correo_Electronico = $row.'Correo Electronico'
    QUIMICO = $row.QUIMICO
    ENTRADA = $row.ENTRADA
    NOTAS = $row.NOTAS
  }
}

$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Add()

  while ($workbook.Worksheets.Count -gt 1) {
    $workbook.Worksheets.Item($workbook.Worksheets.Count).Delete()
  }

  $summarySheet = Write-Worksheet -Workbook $workbook -SheetName "00_Resumen" -Rows $summaryRows -Columns @("section", "metric", "value") -WrapColumns @("value")
  $masterSheet = Write-Worksheet -Workbook $workbook -SheetName "01_Master_Review" -Rows $masterRows -Columns @(
    "review_order", "merge_status", "source_side", "existing_export_check", "match_score",
    "financial_name", "info_name", "suggested_match_1", "suggested_score_1", "suggested_match_2", "suggested_score_2",
    "cliente_full_name", "nombre", "apellidos", "email", "email_original",
    "telefono", "telefono_original", "idiomaPreferencia", "estadoCuenta", "tipoCliente", "allowWeekendBooking",
    "customer_notas", "property_name", "property_address", "sanitizerType", "filterType", "hasSpa",
    "accessLocationNotes", "serviceStartDate", "paymentDay", "servicePrice", "paymentType", "paymentNotes",
    "zelle", "quimico_raw", "entrada_raw", "notas_info_raw", "source_fin_row", "source_info_row", "review_notes"
  ) -WrapColumns @("email_original", "property_address", "accessLocationNotes", "paymentNotes", "review_notes")

  $reviewSheet = Write-Worksheet -Workbook $workbook -SheetName "02_Review_Needed" -Rows $reviewNeededRows -Columns @(
    "merge_status", "source_side", "financial_name", "info_name", "suggested_match_1", "suggested_score_1",
    "suggested_match_2", "suggested_score_2", "cliente_full_name", "email", "telefono", "property_address",
    "serviceStartDate", "paymentDay", "servicePrice", "paymentType", "accessLocationNotes", "paymentNotes", "review_notes"
  ) -WrapColumns @("property_address", "accessLocationNotes", "paymentNotes", "review_notes")

  $financialSheet = Write-Worksheet -Workbook $workbook -SheetName "03_Raw_Financial" -Rows $financialSheetRows -Columns @(
    "source_row", "CLIENTE", "FECHA_DE_INICIO", "DIA_DE_COBRO", "PRECIO", "TIPO_DE_PAGO", "ZELLE"
  )

  $infoSheet = Write-Worksheet -Workbook $workbook -SheetName "04_Raw_Info" -Rows $infoSheetRows -Columns @(
    "source_row", "CLIENTE", "Direccion", "TELEFONO", "Correo_Electronico", "QUIMICO", "ENTRADA", "NOTAS"
  ) -WrapColumns @("Direccion", "Correo_Electronico", "NOTAS")

  foreach ($sheet in @($masterSheet, $reviewSheet)) {
    $lastRow = $sheet.UsedRange.Rows.Count
    for ($row = 2; $row -le $lastRow; $row++) {
      $status = [string]$sheet.Cells.Item($row, 2).Value2
      $color = switch ($status) {
        "EXACT" { 0xE2F0D9 }
        "REVIEW_SINGLE_SUGGESTION" { 0xFFF2CC }
        "REVIEW_MULTI_CANDIDATE" { 0xFCE4D6 }
        "REVIEW_FINANCIAL_ONLY" { 0xEDEDED }
        "REVIEW_INFO_ONLY" { 0xDDEBF7 }
        default { $null }
      }

      if ($color) {
        $sheet.Rows.Item($row).Interior.Color = $color
      }
    }
  }

  $summarySheet.Move($workbook.Worksheets.Item(1)) | Out-Null
  $masterSheet.Move($workbook.Worksheets.Item(2)) | Out-Null
  $reviewSheet.Move($workbook.Worksheets.Item(3)) | Out-Null
  $financialSheet.Move($workbook.Worksheets.Item(4)) | Out-Null
  $infoSheet.Move($workbook.Worksheets.Item(5)) | Out-Null

  foreach ($worksheet in @($workbook.Worksheets)) {
    if ($worksheet.Name -eq "Sheet1") {
      $worksheet.Delete()
      break
    }
  }

  $workbook.SaveAs($OutputPath)
} finally {
  if ($workbook) {
    $workbook.Close($true)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
  }
  if ($excel) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

Write-Output "Workbook created: $OutputPath"

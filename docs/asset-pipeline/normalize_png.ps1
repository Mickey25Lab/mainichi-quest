param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][ValidateSet('asset','background','common')][string]$Kind
)

# Deterministic Windows image resizing. Never edit a source or overwrite output.
Add-Type -AssemblyName System.Drawing
$source = (Resolve-Path -LiteralPath $InputPath).Path
$destination = [System.IO.Path]::GetFullPath($OutputPath)
if ($source -eq $destination -or [System.IO.File]::Exists($destination)) {
    throw 'Output must be a new file distinct from input.'
}
$sourceRoot = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path '01_source_final'))
if ($destination.StartsWith($sourceRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw '01_source_final is read-only.'
}
$width = if ($Kind -eq 'asset') { 1254 } else { 1400 }
$height = if ($Kind -eq 'asset') { 1254 } else { 1050 }
$format = if ($Kind -eq 'background') {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
} else {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
}
$image = [System.Drawing.Image]::FromFile($source)
$bitmap = New-Object System.Drawing.Bitmap($width, $height, $format)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    if ($Kind -eq 'background') {
        $graphics.Clear([System.Drawing.Color]::Black)
        $scale = [Math]::Max($width / $image.Width, $height / $image.Height)
    } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $scale = [Math]::Min($width / $image.Width, $height / $image.Height)
    }
    $drawWidth = [int][Math]::Round($image.Width * $scale)
    $drawHeight = [int][Math]::Round($image.Height * $scale)
    $x = [int][Math]::Floor(($width - $drawWidth) / 2)
    $y = [int][Math]::Floor(($height - $drawHeight) / 2)
    $graphics.DrawImage($image, (New-Object System.Drawing.Rectangle($x, $y, $drawWidth, $drawHeight)))
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination)) | Out-Null
    $stream = New-Object System.IO.FileStream($destination, [System.IO.FileMode]::CreateNew)
    try { $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png) }
    finally { $stream.Dispose() }
    Write-Output $destination
}
finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $image.Dispose()
}

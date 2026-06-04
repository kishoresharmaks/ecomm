$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$OutputRoot = Join-Path $ProjectRoot "docs\ui-screen-images"

$Colors = @{
  Navy = "#163B5C"
  Orange = "#F57C00"
  Green = "#0F8A5F"
  Gold = "#D9A441"
  Ivory = "#FAF7F0"
  Ink = "#1F2933"
  Grey = "#E5E7EB"
  Red = "#D64545"
  White = "#FFFFFF"
  Muted = "#667085"
  SoftNavy = "#EAF1F7"
  SoftOrange = "#FFF1E3"
  SoftGreen = "#E9F7F1"
}

function Escape-Xml {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) { return "" }
  return [System.Security.SecurityElement]::Escape($Value)
}

function Add-Rect {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H,
    [string]$Fill,
    [string]$Stroke = "none",
    [int]$Rx = 0,
    [double]$StrokeWidth = 1,
    [string]$Extra = ""
  )
  $Svg.Add(('<rect x="{0}" y="{1}" width="{2}" height="{3}" rx="{4}" fill="{5}" stroke="{6}" stroke-width="{7}" {8}/>' -f $X, $Y, $W, $H, $Rx, $Fill, $Stroke, $StrokeWidth, $Extra))
}

function Add-Circle {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$Cx,
    [int]$Cy,
    [int]$R,
    [string]$Fill,
    [string]$Stroke = "none",
    [double]$StrokeWidth = 1
  )
  $Svg.Add(('<circle cx="{0}" cy="{1}" r="{2}" fill="{3}" stroke="{4}" stroke-width="{5}"/>' -f $Cx, $Cy, $R, $Fill, $Stroke, $StrokeWidth))
}

function Add-Line {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X1,
    [int]$Y1,
    [int]$X2,
    [int]$Y2,
    [string]$Stroke,
    [double]$StrokeWidth = 1
  )
  $Svg.Add(('<line x1="{0}" y1="{1}" x2="{2}" y2="{3}" stroke="{4}" stroke-width="{5}" stroke-linecap="round"/>' -f $X1, $Y1, $X2, $Y2, $Stroke, $StrokeWidth))
}

function Add-Text {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [string]$Text,
    [int]$Size = 16,
    [string]$Weight = "500",
    [string]$Fill = "#1F2933",
    [string]$Anchor = "start",
    [string]$Extra = ""
  )
  $Svg.Add(('<text x="{0}" y="{1}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="{2}" font-weight="{3}" fill="{4}" text-anchor="{5}" {6}>{7}</text>' -f $X, $Y, $Size, $Weight, $Fill, $Anchor, $Extra, (Escape-Xml $Text)))
}

function Add-WrappedText {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [string]$Text,
    [int]$MaxChars = 46,
    [int]$Size = 15,
    [string]$Fill = "#667085",
    [int]$LineHeight = 22,
    [int]$MaxLines = 3
  )
  $words = @()
  if ($Text) { $words = $Text -split "\s+" }
  $lines = New-Object System.Collections.Generic.List[string]
  $line = ""
  foreach ($word in $words) {
    $candidate = if ($line.Length -eq 0) { $word } else { "$line $word" }
    if ($candidate.Length -le $MaxChars) {
      $line = $candidate
    } else {
      if ($line.Length -gt 0) { $lines.Add($line) }
      $line = $word
    }
  }
  if ($line.Length -gt 0) { $lines.Add($line) }
  $count = [Math]::Min($MaxLines, $lines.Count)
  for ($i = 0; $i -lt $count; $i++) {
    $value = $lines[$i]
    if (($i -eq $MaxLines - 1) -and ($lines.Count -gt $MaxLines)) {
      $value = $value.TrimEnd(".") + "..."
    }
    Add-Text $Svg $X ($Y + ($i * $LineHeight)) $value $Size "400" $Fill
  }
}

function Add-Pill {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [string]$Text,
    [string]$Fill,
    [string]$Color = "#1F2933",
    [int]$W = 0
  )
  $width = if ($W -gt 0) { $W } else { [Math]::Max(82, 18 + ($Text.Length * 8)) }
  Add-Rect $Svg $X $Y $width 30 $Fill "none" 15 0
  Add-Text $Svg ($X + ($width / 2)) ($Y + 20) $Text 13 "700" $Color "middle"
}

function Add-Button {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [int]$W,
    [string]$Text,
    [string]$Fill,
    [string]$Color = "#FFFFFF"
  )
  Add-Rect $Svg $X $Y $W 44 $Fill "none" 8 0
  Add-Text $Svg ($X + ($W / 2)) ($Y + 28) $Text 14 "800" $Color "middle"
}

function Add-Field {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [int]$W,
    [string]$Label,
    [string]$Placeholder = ""
  )
  Add-Text $Svg $X $Y $Label 13 "700" $Colors.Ink
  Add-Rect $Svg $X ($Y + 10) $W 46 $Colors.White $Colors.Grey 7 1
  Add-Text $Svg ($X + 16) ($Y + 39) $Placeholder 13 "400" $Colors.Muted
}

function Add-MiniTable {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [int]$W,
    [string[]]$Columns,
    [string]$Accent = "#163B5C"
  )
  Add-Rect $Svg $X $Y $W 44 $Colors.SoftNavy "none" 6 0
  $colW = [Math]::Floor($W / $Columns.Count)
  for ($i = 0; $i -lt $Columns.Count; $i++) {
    Add-Text $Svg ($X + 18 + ($i * $colW)) ($Y + 28) $Columns[$i] 13 "800" $Accent
  }
  for ($row = 0; $row -lt 5; $row++) {
    $rowY = $Y + 44 + ($row * 50)
    Add-Rect $Svg $X $rowY $W 50 $Colors.White $Colors.Grey 0 1
    for ($i = 0; $i -lt $Columns.Count; $i++) {
      $lineW = [Math]::Max(60, $colW - 48 - (($row + $i) * 5))
      Add-Rect $Svg ($X + 18 + ($i * $colW)) ($rowY + 18) $lineW 10 "#D0D5DD" "none" 5 0
    }
    if ($row -eq 1 -or $row -eq 3) {
      Add-Pill $Svg ($X + $W - 116) ($rowY + 11) "Active" $Colors.SoftGreen $Colors.Green 84
    }
  }
}

function Add-ChartBars {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H
  )
  Add-Rect $Svg $X $Y $W $H $Colors.White $Colors.Grey 8 1
  Add-Text $Svg ($X + 20) ($Y + 32) "Trend view" 15 "800" $Colors.Ink
  for ($i = 0; $i -lt 8; $i++) {
    $barH = 36 + (($i * 31) % 110)
    $barX = $X + 30 + ($i * 52)
    Add-Rect $Svg $barX ($Y + $H - 34 - $barH) 28 $barH $Colors.Orange "none" 5 0
  }
  Add-Line $Svg ($X + 24) ($Y + $H - 34) ($X + $W - 24) ($Y + $H - 34) $Colors.Grey 2
}

function Add-WindowChrome {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [object]$Screen
  )
  Add-Rect $Svg 0 0 1440 960 $Colors.Ivory "none" 0 0
  Add-Rect $Svg 24 20 1392 900 $Colors.White "#D8DEE8" 18 1 "filter=""url(#shadow)"""
  Add-Rect $Svg 24 20 1392 42 "#F8FAFC" "#D8DEE8" 18 1
  Add-Circle $Svg 52 41 6 "#FF5F56"
  Add-Circle $Svg 74 41 6 "#FFBD2E"
  Add-Circle $Svg 96 41 6 "#27C93F"
  Add-Text $Svg 122 47 "1HandIndia Phase 1 UI mockup" 13 "700" $Colors.Muted
  Add-Text $Svg 1380 47 $Screen.Route 13 "600" $Colors.Muted "end"
}

function Add-PublicHeader {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-Rect $Svg 24 62 1392 76 $Colors.Navy "none" 0 0
  Add-Text $Svg 58 111 "1HandIndia" 28 "900" $Colors.White
  Add-Rect $Svg 212 82 520 38 $Colors.White "none" 8 0
  Add-Text $Svg 236 107 "Search products, stores, categories" 13 "500" $Colors.Muted
  Add-Pill $Svg 768 86 "Categories" "#274B68" $Colors.White 112
  Add-Pill $Svg 898 86 "Stores" "#274B68" $Colors.White 88
  Add-Pill $Svg 1002 86 "B2B" "#274B68" $Colors.White 72
  Add-Button $Svg 1132 79 104 "Cart" $Colors.Orange
  Add-Button $Svg 1254 79 120 "Sign in" $Colors.White $Colors.Navy
}

function Add-AppShell {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  $sidebarFill = if ($Screen.Area -eq "Admin Panel") { $Colors.Navy } elseif ($Screen.Area -eq "Seller Center") { "#123C32" } elseif ($Screen.Area -eq "B2B Buyer Portal") { "#332A5C" } else { "#17324A" }
  Add-Rect $Svg 24 62 266 858 $sidebarFill "none" 0 0
  Add-Text $Svg 58 112 "1HandIndia" 27 "900" $Colors.White
  Add-Pill $Svg 58 132 $Screen.Area "#FFFFFF22" $Colors.White 172
  $nav = switch ($Screen.Area) {
    "Customer Account" { @("Dashboard", "Profile", "Addresses", "Wishlist", "Orders", "Support") }
    "Seller Center" { @("Dashboard", "Store Profile", "Products", "Orders", "Delivery", "B2B Enquiries", "Reports") }
    "B2B Buyer Portal" { @("Dashboard", "Company", "New Enquiry", "My Enquiries") }
    "Admin Panel" { @("Dashboard", "Customers", "Sellers", "Products", "Orders", "B2B", "CMS", "Reports", "Settings", "Audit Logs") }
    default { @("Dashboard") }
  }
  $y = 196
  foreach ($item in $nav) {
    $active = $Screen.Title -like "*$item*" -or ($Screen.Title -eq "Admin Dashboard" -and $item -eq "Dashboard") -or ($Screen.Title -eq "Seller Dashboard" -and $item -eq "Dashboard") -or ($Screen.Title -eq "Account Dashboard" -and $item -eq "Dashboard")
    if ($active) {
      Add-Rect $Svg 46 ($y - 22) 220 40 "#FFFFFF2E" "none" 8 0
      Add-Rect $Svg 46 ($y - 22) 5 40 $Colors.Orange "none" 3 0
    }
    Add-Text $Svg 68 $y $item 14 "700" $Colors.White
    $y += 50
  }
  Add-Text $Svg 58 878 "Phase 1 web portal" 12 "600" "#DCE8F2"
  Add-Rect $Svg 290 62 1126 76 "#F8FAFC" $Colors.Grey 0 1
  Add-Text $Svg 326 106 $Screen.Route 13 "700" $Colors.Muted
  Add-Pill $Svg 1134 84 $Screen.Priority $Colors.SoftGreen $Colors.Green 86
  Add-Circle $Svg 1280 100 18 $Colors.Orange
  Add-Text $Svg 1280 106 "1HI" 12 "900" $Colors.White "middle"
  Add-Text $Svg 1312 105 "Logged in role" 13 "700" $Colors.Ink
}

function Add-PageTitle {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [object]$Screen,
    [int]$X,
    [int]$Y,
    [int]$W
  )
  Add-Pill $Svg $X $Y $Screen.Priority $Colors.SoftOrange $Colors.Orange 92
  Add-Text $Svg $X ($Y + 64) $Screen.Title 30 "900" $Colors.Ink
  Add-WrappedText $Svg $X ($Y + 94) $Screen.Purpose 92 15 $Colors.Muted 22 2
  Add-Line $Svg $X ($Y + 148) ($X + $W) ($Y + 148) $Colors.Grey 1
}

function Add-BlockCard {
  param(
    [System.Collections.Generic.List[string]]$Svg,
    [int]$X,
    [int]$Y,
    [int]$W,
    [int]$H,
    [string]$Title,
    [string]$Accent = "#163B5C",
    [string]$Mode = "lines"
  )
  Add-Rect $Svg $X $Y $W $H $Colors.White $Colors.Grey 8 1
  Add-Text $Svg ($X + 20) ($Y + 33) $Title 16 "850" $Colors.Ink
  Add-Rect $Svg ($X + 20) ($Y + 48) 52 5 $Accent "none" 3 0
  if ($Mode -eq "table") {
    Add-MiniTable $Svg ($X + 20) ($Y + 68) ($W - 40) @("Name", "Status", "Owner", "Action") $Accent
  } elseif ($Mode -eq "chart") {
    Add-ChartBars $Svg ($X + 20) ($Y + 68) ($W - 40) ($H - 88)
  } elseif ($Mode -eq "form") {
    Add-Field $Svg ($X + 20) ($Y + 84) ($W - 40) "Primary field" "Required information"
    Add-Field $Svg ($X + 20) ($Y + 154) ($W - 40) "Secondary field" "Additional details"
    Add-Button $Svg ($X + 20) ($Y + $H - 64) 132 "Save" $Accent
  } else {
    for ($i = 0; $i -lt 4; $i++) {
      Add-Rect $Svg ($X + 20) ($Y + 76 + ($i * 34)) ([Math]::Max(100, $W - 76 - ($i * 24))) 12 "#D0D5DD" "none" 6 0
    }
    Add-Pill $Svg ($X + 20) ($Y + $H - 48) "Review" $Colors.SoftNavy $Accent 90
  }
}

function Get-Blocks {
  param([object]$Screen)
  switch ($Screen.Layout) {
    "home" { return @("Hero banner", "Category rails", "Featured products", "Seller highlights") }
    "listing" { return @("Filter panel", "Product grid", "Sort and pagination", "Cart actions") }
    "store-profile" { return @("Store banner", "Seller details", "Product grid", "Trust badges") }
    "product-detail" { return @("Image gallery", "Price and stock", "Seller details", "B2B enquiry") }
    "cart" { return @("Cart items", "Quantity controls", "Price summary", "Checkout action") }
    "checkout" { return @("Address", "Delivery mode", "Payment method", "Order review") }
    "success" { return @("Order number", "Status timeline", "Email notice", "Continue shopping") }
    "contact" { return @("Contact form", "Support info", "Request status", "Email alert") }
    "content" { return @("CMS title", "Content sections", "Policy details", "SEO fields") }
    "auth" { return @("Role entry", "Email or phone", "Password or OTP", "Continue") }
    "dashboard" { return @("KPI summary", "Recent activity", "Pending actions", "Quick shortcuts") }
    "form" { return @("Basic details", "Validation rules", "Upload fields", "Save action") }
    "table" { return @("Search and filters", "Data table", "Status badges", "Bulk actions") }
    "detail" { return @("Record summary", "Timeline", "Related data", "Admin actions") }
    "approval" { return @("Pending queue", "Checklist", "Approve or reject", "Audit note") }
    "delivery" { return @("Courier details", "Tracking reference", "Delivery status", "Timeline") }
    "report" { return @("Date filters", "Summary metrics", "Chart view", "Export table") }
    "settings" { return @("Configuration", "Provider status", "Template toggles", "Audit save") }
    "cms" { return @("Content list", "Preview", "Publish status", "Media upload") }
    "audit" { return @("Action filters", "Audit records", "Entity history", "Actor details") }
    default { return @("Primary panel", "Secondary panel", "Actions", "Status") }
  }
}

function Render-Home {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 58 168 1320
  Add-Rect $Svg 58 336 728 230 $Colors.Navy "none" 14 0
  Add-Text $Svg 98 390 "1HandIndia marketplace" 38 "900" $Colors.White
  Add-WrappedText $Svg 98 430 "Browse trusted Indian sellers, hyperlocal stores, and B2B-ready products from one serious marketplace portal." 54 17 "#E8F0F7" 26 3
  Add-Button $Svg 98 512 156 "Shop now" $Colors.Orange
  Add-Button $Svg 270 512 160 "Seller center" $Colors.White $Colors.Navy
  Add-Rect $Svg 826 336 250 230 $Colors.SoftOrange "none" 14 0
  Add-Text $Svg 858 382 "Top categories" 20 "900" $Colors.Ink
  foreach ($i in 0..4) {
    Add-Pill $Svg 858 (414 + ($i * 30)) ("Category " + ($i + 1)) $Colors.White $Colors.Navy 150
  }
  Add-Rect $Svg 1106 336 272 230 $Colors.SoftGreen "none" 14 0
  Add-Text $Svg 1138 382 "Local seller focus" 20 "900" $Colors.Ink
  Add-WrappedText $Svg 1138 420 "Marketplace sellers, hyperlocal stores, and wholesale distributors use one seller flow in Phase 1." 28 15 $Colors.Muted 22 3
  $x = 58
  foreach ($name in @("Featured product", "Deal product", "New arrival", "B2B enquiry item")) {
    Add-BlockCard $Svg $x 604 315 208 $name $Colors.Orange "lines"
    $x += 335
  }
}

function Render-PublicListing {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 58 168 1320
  Add-Rect $Svg 58 342 250 470 $Colors.White $Colors.Grey 8 1
  Add-Text $Svg 82 380 "Filters" 18 "900" $Colors.Ink
  foreach ($label in @("Category", "Price range", "Seller type", "Availability", "Rating")) {
    Add-Field $Svg 82 (410 + ([array]::IndexOf(@("Category", "Price range", "Seller type", "Availability", "Rating"), $label) * 72)) 178 $label "Select"
  }
  Add-Rect $Svg 338 342 1010 58 "#F8FAFC" $Colors.Grey 8 1
  Add-Text $Svg 362 378 "Showing relevant products and stores" 16 "800" $Colors.Ink
  Add-Pill $Svg 1168 356 "Sort" $Colors.SoftNavy $Colors.Navy 70
  $index = 0
  for ($row = 0; $row -lt 2; $row++) {
    for ($col = 0; $col -lt 3; $col++) {
      $cardX = 338 + ($col * 337)
      $cardY = 430 + ($row * 194)
      Add-Rect $Svg $cardX $cardY 302 166 $Colors.White $Colors.Grey 8 1
      Add-Rect $Svg ($cardX + 18) ($cardY + 18) 86 86 $Colors.SoftNavy "none" 8 0
      Add-Text $Svg ($cardX + 122) ($cardY + 42) ("Item " + ($index + 1)) 16 "900" $Colors.Ink
      Add-Text $Svg ($cardX + 122) ($cardY + 70) "INR 1,499" 16 "900" $Colors.Orange
      Add-WrappedText $Svg ($cardX + 122) ($cardY + 96) "Approved seller, stock ready, delivery available." 22 12 $Colors.Muted 17 2
      Add-Button $Svg ($cardX + 122) ($cardY + 126) 110 "Add" $Colors.Orange
      $index++
    }
  }
}

function Render-ProductDetail {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 58 168 1320
  Add-Rect $Svg 58 342 430 380 $Colors.White $Colors.Grey 8 1
  Add-Rect $Svg 88 372 370 250 $Colors.SoftNavy "none" 10 0
  foreach ($i in 0..3) {
    Add-Rect $Svg (88 + ($i * 92)) 642 78 62 $Colors.White $Colors.Grey 6 1
  }
  Add-Rect $Svg 528 342 496 380 $Colors.White $Colors.Grey 8 1
  Add-Text $Svg 562 386 "Product name and variant" 28 "900" $Colors.Ink
  Add-Text $Svg 562 430 "INR 2,499" 28 "900" $Colors.Orange
  Add-Pill $Svg 562 454 "In stock" $Colors.SoftGreen $Colors.Green 96
  Add-WrappedText $Svg 562 508 "Image gallery, price, stock, seller info, add to cart, wishlist, and B2B enquiry are visible on this screen." 50 15 $Colors.Muted 23 3
  Add-Button $Svg 562 612 150 "Add to cart" $Colors.Orange
  Add-Button $Svg 728 612 152 "Wishlist" $Colors.Navy
  Add-Rect $Svg 1058 342 290 178 $Colors.SoftGreen "none" 8 0
  Add-Text $Svg 1084 382 "Seller card" 20 "900" $Colors.Ink
  Add-WrappedText $Svg 1084 420 "Store name, local shop badge, city, support contact, and public store link." 29 14 $Colors.Muted 21 3
  Add-Rect $Svg 1058 544 290 178 $Colors.SoftOrange "none" 8 0
  Add-Text $Svg 1084 584 "B2B enquiry" 20 "900" $Colors.Ink
  Add-WrappedText $Svg 1084 622 "Business buyer can ask for quantity and quotation from this product." 29 14 $Colors.Muted 21 3
}

function Render-CartCheckout {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 58 168 1320
  $steps = if ($Screen.Layout -eq "checkout") { @("Cart", "Address", "Delivery", "Payment", "Review") } else { @("Cart", "Review", "Checkout") }
  $x = 58
  foreach ($step in $steps) {
    Add-Pill $Svg $x 334 $step $Colors.SoftNavy $Colors.Navy 118
    $x += 132
  }
  Add-Rect $Svg 58 392 820 350 $Colors.White $Colors.Grey 8 1
  Add-Text $Svg 88 432 $Screen.Title 22 "900" $Colors.Ink
  if ($Screen.Layout -eq "checkout") {
    Add-Field $Svg 88 476 360 "Delivery address" "Choose saved address"
    Add-Field $Svg 88 550 360 "Delivery mode" "Manual courier / local delivery"
    Add-Field $Svg 88 624 360 "Payment method" "COD / Razorpay readiness"
    Add-BlockCard $Svg 482 474 348 180 "Order review" $Colors.Orange "lines"
  } else {
    Add-MiniTable $Svg 88 476 736 @("Product", "Seller", "Qty", "Amount") $Colors.Navy
  }
  Add-Rect $Svg 920 392 428 350 $Colors.SoftOrange "none" 8 0
  Add-Text $Svg 952 436 "Price summary" 22 "900" $Colors.Ink
  foreach ($row in @("Subtotal", "Shipping", "Tax / fees", "Total")) {
    $yy = 486 + ([array]::IndexOf(@("Subtotal", "Shipping", "Tax / fees", "Total"), $row) * 48)
    Add-Text $Svg 952 $yy $row 15 "700" $Colors.Ink
    Add-Text $Svg 1294 $yy "INR 0" 15 "800" $Colors.Ink "end"
  }
  Add-Button $Svg 952 674 180 "Continue" $Colors.Orange
}

function Render-Success {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 58 168 1320
  Add-Rect $Svg 250 350 940 388 $Colors.White $Colors.Grey 12 1
  Add-Circle $Svg 720 430 48 $Colors.Green
  Add-Text $Svg 720 448 "OK" 24 "900" $Colors.White "middle"
  Add-Text $Svg 720 520 $Screen.Title 30 "900" $Colors.Ink "middle"
  Add-Text $Svg 720 558 "Order number, email confirmation, and next steps are shown clearly." 16 "500" $Colors.Muted "middle"
  $x = 402
  foreach ($step in @("Placed", "Confirmed", "Processing", "Dispatched", "Delivered")) {
    Add-Circle $Svg $x 632 15 $Colors.Green
    Add-Text $Svg $x 674 $step 13 "800" $Colors.Ink "middle"
    if ($x -lt 1038) { Add-Line $Svg ($x + 18) 632 ($x + 140) 632 $Colors.Grey 3 }
    $x += 160
  }
  Add-Button $Svg 612 706 216 "Continue shopping" $Colors.Orange
}

function Render-Content {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 58 168 1320
  Add-Rect $Svg 58 342 860 420 $Colors.White $Colors.Grey 8 1
  Add-Text $Svg 92 386 $Screen.Title 28 "900" $Colors.Ink
  foreach ($i in 0..7) {
    Add-Rect $Svg 92 (430 + ($i * 38)) (700 - ($i % 3 * 70)) 12 "#D0D5DD" "none" 6 0
  }
  Add-Rect $Svg 960 342 388 420 $Colors.SoftNavy "none" 8 0
  Add-Text $Svg 994 386 "CMS controlled page" 22 "900" $Colors.Ink
  Add-WrappedText $Svg 994 424 $Screen.Purpose 34 15 $Colors.Muted 23 4
  Add-BlockCard $Svg 994 548 310 150 "Admin edit support" $Colors.Navy "lines"
}

function Render-Auth {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-Rect $Svg 24 62 626 858 $Colors.Navy "none" 0 0
  Add-Text $Svg 78 136 "1HandIndia" 34 "900" $Colors.White
  Add-Text $Svg 78 220 $Screen.Area 18 "800" "#DCE8F2"
  Add-WrappedText $Svg 78 266 $Screen.Purpose 52 20 "#F3F8FC" 31 5
  Add-Rect $Svg 78 506 490 190 "#FFFFFF1D" "none" 12 0
  Add-Text $Svg 112 554 "Secure access for Phase 1 marketplace roles" 22 "900" $Colors.White
  Add-WrappedText $Svg 112 596 "Customer, seller, B2B, and admin experiences remain clearly separated." 43 16 "#DCE8F2" 25 3
  Add-Rect $Svg 762 198 470 520 $Colors.White $Colors.Grey 12 1 "filter=""url(#shadow)"""
  Add-Pill $Svg 802 246 $Screen.Priority $Colors.SoftOrange $Colors.Orange 92
  Add-Text $Svg 802 312 $Screen.Title 30 "900" $Colors.Ink
  Add-WrappedText $Svg 802 346 $Screen.Route 44 14 $Colors.Muted 20 1
  Add-Field $Svg 802 402 390 "Email or mobile number" "name@example.com"
  Add-Field $Svg 802 482 390 "Password / OTP" "Enter secure value"
  Add-Button $Svg 802 580 390 "Continue" $Colors.Orange
  Add-Text $Svg 802 660 "Auth provider integration can be wired later during development." 13 "500" $Colors.Muted
}

function Render-AppContent {
  param([System.Collections.Generic.List[string]]$Svg, [object]$Screen)
  Add-PageTitle $Svg $Screen 326 168 1022
  $blocks = Get-Blocks $Screen
  switch ($Screen.Layout) {
    "dashboard" {
      $x = 326
      $metricIndex = 0
      foreach ($metric in @("Orders", "Products", "Sales", "Alerts")) {
        Add-Rect $Svg $x 338 236 116 $Colors.White $Colors.Grey 8 1
        Add-Text $Svg ($x + 22) 378 $metric 14 "800" $Colors.Muted
        $metricValue = 24 + (($Screen.Number * 37) + ($metricIndex * 59)) % 420
        Add-Text $Svg ($x + 22) 420 ([string]$metricValue) 32 "900" $Colors.Navy
        $x += 262
        $metricIndex++
      }
      Add-BlockCard $Svg 326 490 500 278 $blocks[1] $Colors.Navy "table"
      Add-BlockCard $Svg 852 490 496 278 $blocks[2] $Colors.Orange "chart"
    }
    "table" {
      Add-Rect $Svg 326 334 1022 68 "#F8FAFC" $Colors.Grey 8 1
      Add-Field $Svg 352 356 340 "Search" "Filter records"
      Add-Pill $Svg 1050 354 "Status" $Colors.SoftNavy $Colors.Navy 94
      Add-Pill $Svg 1162 354 "Export" $Colors.SoftOrange $Colors.Orange 94
      Add-MiniTable $Svg 326 430 1022 @("Name", "Type", "Status", "Updated", "Action") $Colors.Navy
    }
    "form" {
      Add-BlockCard $Svg 326 334 480 390 $blocks[0] $Colors.Navy "form"
      Add-BlockCard $Svg 834 334 514 188 $blocks[1] $Colors.Green "lines"
      Add-BlockCard $Svg 834 544 514 180 $blocks[2] $Colors.Orange "lines"
    }
    "detail" {
      Add-BlockCard $Svg 326 334 466 210 $blocks[0] $Colors.Navy "lines"
      Add-BlockCard $Svg 820 334 528 210 $blocks[2] $Colors.Green "table"
      Add-Rect $Svg 326 578 1022 170 $Colors.White $Colors.Grey 8 1
      Add-Text $Svg 356 620 $blocks[1] 18 "900" $Colors.Ink
      $x = 374
      foreach ($step in @("Created", "Reviewed", "Updated", "Notified")) {
        Add-Circle $Svg $x 674 13 $Colors.Orange
        Add-Text $Svg $x 710 $step 13 "800" $Colors.Ink "middle"
        if ($x -lt 1120) { Add-Line $Svg ($x + 18) 674 ($x + 190) 674 $Colors.Grey 3 }
        $x += 248
      }
    }
    "approval" {
      Add-BlockCard $Svg 326 334 550 390 $blocks[0] $Colors.Orange "table"
      Add-BlockCard $Svg 904 334 444 180 $blocks[1] $Colors.Navy "lines"
      Add-BlockCard $Svg 904 544 444 180 $blocks[2] $Colors.Green "form"
    }
    "delivery" {
      Add-BlockCard $Svg 326 334 500 390 $blocks[0] $Colors.Navy "form"
      Add-BlockCard $Svg 852 334 496 180 $blocks[2] $Colors.Green "lines"
      Add-BlockCard $Svg 852 544 496 180 $blocks[3] $Colors.Orange "lines"
    }
    "report" {
      Add-Rect $Svg 326 334 1022 66 "#F8FAFC" $Colors.Grey 8 1
      Add-Pill $Svg 356 352 "Date range" $Colors.SoftNavy $Colors.Navy 118
      Add-Pill $Svg 490 352 "Seller" $Colors.SoftNavy $Colors.Navy 90
      Add-Pill $Svg 596 352 "Export" $Colors.SoftOrange $Colors.Orange 94
      Add-ChartBars $Svg 326 430 626 288
      Add-BlockCard $Svg 978 430 370 288 $blocks[1] $Colors.Green "lines"
    }
    "settings" {
      Add-BlockCard $Svg 326 334 500 390 $blocks[0] $Colors.Navy "form"
      Add-BlockCard $Svg 852 334 496 180 $blocks[1] $Colors.Green "lines"
      Add-BlockCard $Svg 852 544 496 180 $blocks[2] $Colors.Orange "lines"
    }
    "cms" {
      Add-BlockCard $Svg 326 334 500 390 $blocks[0] $Colors.Navy "table"
      Add-BlockCard $Svg 852 334 496 390 $blocks[1] $Colors.Orange "lines"
    }
    "audit" {
      Add-Rect $Svg 326 334 1022 68 "#F8FAFC" $Colors.Grey 8 1
      Add-Pill $Svg 356 354 "Actor" $Colors.SoftNavy $Colors.Navy 86
      Add-Pill $Svg 458 354 "Entity" $Colors.SoftNavy $Colors.Navy 90
      Add-Pill $Svg 564 354 "Date" $Colors.SoftNavy $Colors.Navy 78
      Add-MiniTable $Svg 326 430 1022 @("Time", "Actor", "Action", "Entity", "IP") $Colors.Red
    }
    default {
      Add-BlockCard $Svg 326 334 480 390 $blocks[0] $Colors.Navy "lines"
      Add-BlockCard $Svg 834 334 514 390 $blocks[1] $Colors.Orange "lines"
    }
  }
}

function Render-Screen {
  param([object]$Screen)
  $svg = New-Object System.Collections.Generic.List[string]
  $svg.Add('<?xml version="1.0" encoding="UTF-8"?>')
  $svg.Add('<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960" viewBox="0 0 1440 960" role="img" aria-labelledby="title desc">')
  $svg.Add(('<title id="title">1HandIndia - {0}</title>' -f (Escape-Xml $Screen.Title)))
  $svg.Add(('<desc id="desc">Phase 1 UI mockup for {0}, route {1}</desc>' -f (Escape-Xml $Screen.Title), (Escape-Xml $Screen.Route)))
  $svg.Add('<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#101828" flood-opacity="0.12"/></filter></defs>')
  Add-WindowChrome $svg $Screen

  if ($Screen.Layout -eq "auth") {
    Render-Auth $svg $Screen
  } elseif ($Screen.Area -eq "Public Storefront") {
    Add-PublicHeader $svg $Screen
    switch ($Screen.Layout) {
      "home" { Render-Home $svg $Screen }
      "product-detail" { Render-ProductDetail $svg $Screen }
      "cart" { Render-CartCheckout $svg $Screen }
      "checkout" { Render-CartCheckout $svg $Screen }
      "success" { Render-Success $svg $Screen }
      "contact" { Render-Content $svg $Screen }
      "content" { Render-Content $svg $Screen }
      "store-profile" { Render-PublicListing $svg $Screen }
      default { Render-PublicListing $svg $Screen }
    }
  } else {
    Add-AppShell $svg $Screen
    Render-AppContent $svg $Screen
  }

  Add-Text $svg 720 894 "1HandIndia UI mockup image - Phase 1 frozen screen list - Not a coded screenshot" 12 "700" $Colors.Muted "middle"
  $svg.Add('</svg>')
  return ($svg -join [Environment]::NewLine)
}

function New-Screen {
  param(
    [string]$Group,
    [string]$Area,
    [int]$Number,
    [string]$Title,
    [string]$Route,
    [string]$Priority,
    [string]$Purpose,
    [string]$Layout
  )
  return [pscustomobject]@{
    Group = $Group
    Area = $Area
    Number = $Number
    Title = $Title
    Route = $Route
    Priority = $Priority
    Purpose = $Purpose
    Layout = $Layout
  }
}

function Get-Slug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
  $slug = $slug.Trim("-") -replace "-+", "-"
  return $slug
}

$Screens = @(
  (New-Screen "public" "Public Storefront" 1 "Homepage" "/" "Must" "Main shopping entry with banners, categories, featured products, and seller highlights." "home"),
  (New-Screen "public" "Public Storefront" 2 "Category Listing" "/categories" "Must" "Show all active categories." "listing"),
  (New-Screen "public" "Public Storefront" 3 "Category Detail / Product List" "/categories/[slug]" "Must" "Show products under selected category with basic filters." "listing"),
  (New-Screen "public" "Public Storefront" 4 "Product Search Results" "/search" "Must" "Search products by keyword with filters and sorting." "listing"),
  (New-Screen "public" "Public Storefront" 5 "Product Detail" "/products/[slug]" "Must" "Product images, price, stock, seller info, add to cart, wishlist, B2B enquiry." "product-detail"),
  (New-Screen "public" "Public Storefront" 6 "Seller / Store Profile" "/stores/[slug]" "Must" "Public seller/local shop page with products and store details." "store-profile"),
  (New-Screen "public" "Public Storefront" 7 "Cart" "/cart" "Must" "Review cart items, update quantity, remove items." "cart"),
  (New-Screen "public" "Public Storefront" 8 "Checkout" "/checkout" "Must" "Address, delivery mode, payment method, order review." "checkout"),
  (New-Screen "public" "Public Storefront" 9 "Order Success" "/checkout/success/[orderNumber]" "Must" "Confirm order placement and show next steps." "success"),
  (New-Screen "public" "Public Storefront" 10 "Track Order Public Entry" "/track-order" "Should" "Optional lookup by order number and contact value." "content"),
  (New-Screen "public" "Public Storefront" 11 "About Page" "/about" "Should" "Business intro if client provides content." "content"),
  (New-Screen "public" "Public Storefront" 12 "Contact Page" "/contact" "Must" "Customer enquiry/contact form and support info." "contact"),
  (New-Screen "public" "Public Storefront" 13 "Privacy Policy" "/privacy-policy" "Must" "CMS-managed policy page." "content"),
  (New-Screen "public" "Public Storefront" 14 "Terms and Conditions" "/terms-and-conditions" "Must" "CMS-managed policy page." "content"),
  (New-Screen "public" "Public Storefront" 15 "Refund / Return Policy" "/refund-return-policy" "Must" "CMS-managed policy page." "content"),
  (New-Screen "public" "Public Storefront" 16 "Shipping Policy" "/shipping-policy" "Should" "Shipping rules if content is provided." "content"),
  (New-Screen "public" "Public Storefront" 17 "Seller Policy" "/seller-policy" "Should" "Seller rules if content is provided." "content"),

  (New-Screen "customer" "Customer Account" 1 "Customer Sign In" "/sign-in" "Must" "Customer login through selected auth provider." "auth"),
  (New-Screen "customer" "Customer Account" 2 "Customer Sign Up" "/sign-up" "Must" "Customer registration." "auth"),
  (New-Screen "customer" "Customer Account" 3 "Account Dashboard" "/account" "Must" "Summary of orders, addresses, wishlist, and profile." "dashboard"),
  (New-Screen "customer" "Customer Account" 4 "Profile" "/account/profile" "Must" "Customer name, phone, email, and basic profile data." "form"),
  (New-Screen "customer" "Customer Account" 5 "Address Book" "/account/addresses" "Must" "Add, edit, delete delivery addresses." "form"),
  (New-Screen "customer" "Customer Account" 6 "Wishlist" "/account/wishlist" "Must" "Saved products." "table"),
  (New-Screen "customer" "Customer Account" 7 "Order History" "/account/orders" "Must" "Customer orders with payment and delivery status." "table"),
  (New-Screen "customer" "Customer Account" 8 "Order Detail" "/account/orders/[orderNumber]" "Must" "Order items, seller split, delivery details, status timeline." "detail"),
  (New-Screen "customer" "Customer Account" 9 "Support / Contact Requests" "/account/support" "Should" "Customer submitted contact/support requests." "table"),

  (New-Screen "seller" "Seller Center" 1 "Seller Sign In" "/seller/sign-in" "Must" "Seller login." "auth"),
  (New-Screen "seller" "Seller Center" 2 "Seller Registration" "/seller/register" "Must" "Seller registration with operational and legal business type." "auth"),
  (New-Screen "seller" "Seller Center" 3 "Seller Pending Approval" "/seller/pending-approval" "Must" "Message shown until admin approves seller." "success"),
  (New-Screen "seller" "Seller Center" 4 "Seller Dashboard" "/seller" "Must" "Sales summary, product count, order count, enquiry count." "dashboard"),
  (New-Screen "seller" "Seller Center" 5 "Store Profile" "/seller/store-profile" "Must" "Store name, logo, banner, address, city, area, contact, business details." "form"),
  (New-Screen "seller" "Seller Center" 6 "Product List" "/seller/products" "Must" "Seller product table with status and stock." "table"),
  (New-Screen "seller" "Seller Center" 7 "Add Product" "/seller/products/new" "Must" "Create product with images, category, price, stock, description." "form"),
  (New-Screen "seller" "Seller Center" 8 "Edit Product" "/seller/products/[id]/edit" "Must" "Update seller-owned product." "form"),
  (New-Screen "seller" "Seller Center" 9 "Seller Orders" "/seller/orders" "Must" "Orders containing seller's products." "table"),
  (New-Screen "seller" "Seller Center" 10 "Seller Order Detail" "/seller/orders/[orderNumber]" "Must" "Seller items, customer delivery info, status updates allowed by rules." "detail"),
  (New-Screen "seller" "Seller Center" 11 "Delivery Update" "/seller/orders/[orderNumber]/delivery" "Must" "Manual delivery partner/courier details and delivery status update." "delivery"),
  (New-Screen "seller" "Seller Center" 12 "B2B Enquiries" "/seller/b2b-enquiries" "Must" "Product-wise B2B enquiries visible to seller." "table"),
  (New-Screen "seller" "Seller Center" 13 "B2B Enquiry Detail" "/seller/b2b-enquiries/[id]" "Must" "View enquiry and send manual response." "detail"),
  (New-Screen "seller" "Seller Center" 14 "Sales Summary" "/seller/reports/sales" "Should" "Basic sales summary for seller." "report"),

  (New-Screen "b2b" "B2B Buyer Portal" 1 "B2B Registration" "/b2b/register" "Must" "Business buyer registration and company details." "auth"),
  (New-Screen "b2b" "B2B Buyer Portal" 2 "B2B Sign In" "/b2b/sign-in" "Must" "Business buyer login." "auth"),
  (New-Screen "b2b" "B2B Buyer Portal" 3 "B2B Dashboard" "/b2b" "Must" "Enquiry summary and profile status." "dashboard"),
  (New-Screen "b2b" "B2B Buyer Portal" 4 "Company Profile" "/b2b/company-profile" "Must" "Company name, GST, contact, address." "form"),
  (New-Screen "b2b" "B2B Buyer Portal" 5 "Submit Product Enquiry" "/b2b/enquiries/new" "Must" "Create bulk/product enquiry." "form"),
  (New-Screen "b2b" "B2B Buyer Portal" 6 "My Enquiries" "/b2b/enquiries" "Must" "List submitted enquiries and statuses." "table"),
  (New-Screen "b2b" "B2B Buyer Portal" 7 "Enquiry Detail" "/b2b/enquiries/[id]" "Must" "View enquiry, seller/admin response, and status." "detail"),

  (New-Screen "admin" "Admin Panel" 1 "Admin Sign In" "/admin/sign-in" "Must" "Admin login." "auth"),
  (New-Screen "admin" "Admin Panel" 2 "Admin Dashboard" "/admin" "Must" "Orders, sellers, products, enquiries, sales summary." "dashboard"),
  (New-Screen "admin" "Admin Panel" 3 "Customers" "/admin/customers" "Must" "View and manage customer records." "table"),
  (New-Screen "admin" "Admin Panel" 4 "Customer Detail" "/admin/customers/[id]" "Should" "Profile, addresses, order history." "detail"),
  (New-Screen "admin" "Admin Panel" 5 "Sellers" "/admin/sellers" "Must" "Seller list, approval status, suspension status." "table"),
  (New-Screen "admin" "Admin Panel" 6 "Seller Detail" "/admin/sellers/[id]" "Must" "Store profile, documents, products, orders, actions." "detail"),
  (New-Screen "admin" "Admin Panel" 7 "Seller Approval Queue" "/admin/sellers/approvals" "Must" "Approve/reject pending seller registrations." "approval"),
  (New-Screen "admin" "Admin Panel" 8 "Business Buyers" "/admin/business-buyers" "Must" "B2B buyer list and company details." "table"),
  (New-Screen "admin" "Admin Panel" 9 "Categories" "/admin/categories" "Must" "Add/edit/deactivate categories and subcategories." "table"),
  (New-Screen "admin" "Admin Panel" 10 "Products" "/admin/products" "Must" "Product list, filters, approval status." "table"),
  (New-Screen "admin" "Admin Panel" 11 "Product Approval Queue" "/admin/products/approvals" "Must" "Approve/reject seller-submitted products." "approval"),
  (New-Screen "admin" "Admin Panel" 12 "Orders" "/admin/orders" "Must" "All orders with statuses, payment, delivery mode." "table"),
  (New-Screen "admin" "Admin Panel" 13 "Order Detail" "/admin/orders/[orderNumber]" "Must" "Order items, seller split, customer, payment, delivery, audit." "detail"),
  (New-Screen "admin" "Admin Panel" 14 "Manual Delivery Update" "/admin/orders/[orderNumber]/delivery" "Must" "Manual delivery partner/courier details and status update." "delivery"),
  (New-Screen "admin" "Admin Panel" 15 "B2B Enquiries" "/admin/b2b-enquiries" "Must" "View all B2B enquiries." "table"),
  (New-Screen "admin" "Admin Panel" 16 "B2B Enquiry Detail" "/admin/b2b-enquiries/[id]" "Must" "View enquiry, seller mapping, manual response, status." "detail"),
  (New-Screen "admin" "Admin Panel" 17 "Banners" "/admin/cms/banners" "Must" "Manage homepage banners." "cms"),
  (New-Screen "admin" "Admin Panel" 18 "Homepage Content" "/admin/cms/homepage" "Must" "Manage sections, featured categories/products." "cms"),
  (New-Screen "admin" "Admin Panel" 19 "CMS Pages" "/admin/cms/pages" "Must" "Manage About, Contact, policies." "table"),
  (New-Screen "admin" "Admin Panel" 20 "Support / Contact Requests" "/admin/support-requests" "Must" "View and respond to contact/support requests." "table"),
  (New-Screen "admin" "Admin Panel" 21 "Reports Overview" "/admin/reports" "Must" "Basic sales, seller, product, and enquiry reports." "report"),
  (New-Screen "admin" "Admin Panel" 22 "Sales Report" "/admin/reports/sales" "Must" "Date-wise sales summary." "report"),
  (New-Screen "admin" "Admin Panel" 23 "Seller Report" "/admin/reports/sellers" "Must" "Seller-wise product/order summary." "report"),
  (New-Screen "admin" "Admin Panel" 24 "Product Report" "/admin/reports/products" "Must" "Product-wise stock and sales summary." "report"),
  (New-Screen "admin" "Admin Panel" 25 "Enquiry Report" "/admin/reports/enquiries" "Must" "B2B/contact enquiry summary." "report"),
  (New-Screen "admin" "Admin Panel" 26 "Commission Settings" "/admin/settings/commissions" "Must" "Manual commission or percentage setup." "settings"),
  (New-Screen "admin" "Admin Panel" 27 "Shipping Settings" "/admin/settings/shipping" "Must" "Basic shipping charge rules and delivery modes." "settings"),
  (New-Screen "admin" "Admin Panel" 28 "Payment Settings" "/admin/settings/payments" "Should" "Payment readiness settings and provider status." "settings"),
  (New-Screen "admin" "Admin Panel" 29 "Email Settings" "/admin/settings/email" "Must" "Sender name, sender email, provider status, template toggles." "settings"),
  (New-Screen "admin" "Admin Panel" 30 "Admin Users / Roles" "/admin/settings/users" "Must" "Basic admin users and role assignment." "table"),
  (New-Screen "admin" "Admin Panel" 31 "Audit Logs" "/admin/audit-logs" "Must" "Sensitive action history." "audit"),
  (New-Screen "admin" "Admin Panel" 32 "General Settings" "/admin/settings/general" "Must" "Brand, contact, support, and business settings." "settings")
)

if (Test-Path $OutputRoot) {
  Get-ChildItem -Path $OutputRoot -Recurse -Filter "*.svg" | Remove-Item -Force
}

foreach ($group in @("public", "customer", "seller", "b2b", "admin")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $OutputRoot $group) | Out-Null
}

$GalleryItems = New-Object System.Collections.Generic.List[object]
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

foreach ($screen in $Screens) {
  $fileName = "{0:d2}-{1}.svg" -f $screen.Number, (Get-Slug $screen.Title)
  $relativePath = Join-Path $screen.Group $fileName
  $targetPath = Join-Path $OutputRoot $relativePath
  $svg = Render-Screen $screen
  [System.IO.File]::WriteAllText($targetPath, $svg, $Utf8NoBom)
  $GalleryItems.Add([pscustomobject]@{
    Area = $screen.Area
    Group = $screen.Group
    Number = $screen.Number
    Title = $screen.Title
    Route = $screen.Route
    Priority = $screen.Priority
    Path = ($relativePath -replace "\\", "/")
  })
}

$readme = New-Object System.Collections.Generic.List[string]
$readme.Add("# 1HandIndia UI Screen Image Pack")
$readme.Add("")
$readme.Add("Generated from ``docs/IndiHub_UI_SCREEN_LIST_AND_DATABASE_PLAN.md``.")
$readme.Add("")
$readme.Add("- Format: SVG image mockups.")
$readme.Add("- Size: 1440 x 960 each.")
$readme.Add("- Total UI screen images: $($Screens.Count).")
$readme.Add("- Purpose: Client review and development planning before app scaffolding.")
$readme.Add("- Note: These are visual planning mockups, not screenshots from a coded application.")
$readme.Add("")
$readme.Add("Open ``index.html`` in a browser to review the full gallery.")
$readme.Add("")
foreach ($area in ($GalleryItems | Select-Object -ExpandProperty Area -Unique)) {
  $readme.Add("## $area")
  $readme.Add("")
  foreach ($item in ($GalleryItems | Where-Object { $_.Area -eq $area })) {
    $readme.Add(("- [{0:d2} - {1}]({2}) - ``{3}``" -f $item.Number, $item.Title, $item.Path, $item.Route))
  }
  $readme.Add("")
}
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "README.md"), ($readme -join [Environment]::NewLine), $Utf8NoBom)

$html = New-Object System.Collections.Generic.List[string]
$html.Add("<!doctype html>")
$html.Add("<html lang=""en"">")
$html.Add("<head>")
$html.Add("  <meta charset=""utf-8"">")
$html.Add("  <meta name=""viewport"" content=""width=device-width, initial-scale=1"">")
$html.Add("  <title>1HandIndia UI Screen Image Gallery</title>")
$html.Add("  <style>")
$html.Add("    :root { --navy: #163B5C; --orange: #F57C00; --green: #0F8A5F; --ivory: #FAF7F0; --ink: #1F2933; --grey: #E5E7EB; }")
$html.Add("    * { box-sizing: border-box; }")
$html.Add("    body { margin: 0; font-family: Inter, Segoe UI, Arial, sans-serif; background: var(--ivory); color: var(--ink); }")
$html.Add("    header { padding: 32px 40px; background: var(--navy); color: white; }")
$html.Add("    h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: 0; }")
$html.Add("    header p { margin: 0; color: #dce8f2; }")
$html.Add("    main { padding: 28px 40px 54px; }")
$html.Add("    .area { margin: 0 0 42px; }")
$html.Add("    .area h2 { margin: 0 0 18px; font-size: 22px; color: var(--navy); }")
$html.Add("    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }")
$html.Add("    article { background: white; border: 1px solid var(--grey); border-radius: 8px; overflow: hidden; }")
$html.Add("    article a { color: inherit; text-decoration: none; display: block; }")
$html.Add("    img { width: 100%; display: block; background: white; }")
$html.Add("    .meta { padding: 14px 16px 16px; border-top: 1px solid var(--grey); }")
$html.Add("    .title { font-weight: 800; margin-bottom: 6px; }")
$html.Add("    .route { font-size: 13px; color: #667085; }")
$html.Add("    .chip { display: inline-block; margin-top: 10px; padding: 4px 9px; border-radius: 999px; background: #FFF1E3; color: var(--orange); font-size: 12px; font-weight: 800; }")
$html.Add("  </style>")
$html.Add("</head>")
$html.Add("<body>")
$html.Add("  <header>")
$html.Add("    <h1>1HandIndia UI Screen Image Gallery</h1>")
$html.Add("    <p>79 Phase 1 SVG mockup images generated from the frozen UI screen list.</p>")
$html.Add("  </header>")
$html.Add("  <main>")
foreach ($area in ($GalleryItems | Select-Object -ExpandProperty Area -Unique)) {
  $html.Add("    <section class=""area"">")
  $html.Add("      <h2>$(Escape-Xml $area)</h2>")
  $html.Add("      <div class=""grid"">")
  foreach ($item in ($GalleryItems | Where-Object { $_.Area -eq $area })) {
    $title = Escape-Xml ("{0:d2} - {1}" -f $item.Number, $item.Title)
    $route = Escape-Xml $item.Route
    $path = Escape-Xml $item.Path
    $priority = Escape-Xml $item.Priority
    $html.Add("        <article><a href=""$path"" target=""_blank""><img src=""$path"" alt=""$title UI mockup""><div class=""meta""><div class=""title"">$title</div><div class=""route"">$route</div><span class=""chip"">$priority</span></div></a></article>")
  }
  $html.Add("      </div>")
  $html.Add("    </section>")
}
$html.Add("  </main>")
$html.Add("</body>")
$html.Add("</html>")
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "index.html"), ($html -join [Environment]::NewLine), $Utf8NoBom)

$sheet = New-Object System.Collections.Generic.List[string]
$sheet.Add('<?xml version="1.0" encoding="UTF-8"?>')
$sheet.Add('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2600" viewBox="0 0 1800 2600">')
$sheet.Add('<rect width="1800" height="2600" fill="#FAF7F0"/>')
$sheet.Add('<text x="72" y="88" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="42" font-weight="900" fill="#163B5C">1HandIndia Phase 1 UI Screens</text>')
$sheet.Add('<text x="72" y="126" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#667085">Contact sheet for 79 generated SVG screen mockups</text>')
$cellW = 314
$cellH = 154
$startX = 72
$startY = 176
$gapX = 28
$gapY = 26
for ($i = 0; $i -lt $GalleryItems.Count; $i++) {
  $item = $GalleryItems[$i]
  $col = $i % 5
  $row = [Math]::Floor($i / 5)
  $x = $startX + ($col * ($cellW + $gapX))
  $y = $startY + ($row * ($cellH + $gapY))
  $sheet.Add(('<rect x="{0}" y="{1}" width="{2}" height="{3}" rx="8" fill="#FFFFFF" stroke="#E5E7EB"/>' -f $x, $y, $cellW, $cellH))
  $sheet.Add(('<rect x="{0}" y="{1}" width="{2}" height="36" rx="8" fill="#163B5C"/>' -f $x, $y, $cellW))
  $sheet.Add(('<text x="{0}" y="{1}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14" font-weight="800" fill="#FFFFFF">{2:d2}. {3}</text>' -f ($x + 14), ($y + 24), $item.Number, (Escape-Xml $item.Title)))
  $sheet.Add(('<text x="{0}" y="{1}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="600" fill="#667085">{2}</text>' -f ($x + 14), ($y + 64), (Escape-Xml $item.Area)))
  $sheet.Add(('<text x="{0}" y="{1}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="500" fill="#667085">{2}</text>' -f ($x + 14), ($y + 88), (Escape-Xml $item.Route)))
  $sheet.Add(('<rect x="{0}" y="{1}" width="78" height="24" rx="12" fill="#FFF1E3"/>' -f ($x + 14), ($y + 112)))
  $sheet.Add(('<text x="{0}" y="{1}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="11" font-weight="800" fill="#F57C00">{2}</text>' -f ($x + 30), ($y + 128), (Escape-Xml $item.Priority)))
}
$sheet.Add('</svg>')
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "IndiHub_All_UI_Screens_Contact_Sheet.svg"), ($sheet -join [Environment]::NewLine), $Utf8NoBom)

Write-Host "Generated $($Screens.Count) SVG UI screen mockups in $OutputRoot"

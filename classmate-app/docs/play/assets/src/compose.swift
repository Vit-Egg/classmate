import AppKit

// compose <phone|card> <vstup.png> <výstup.png> "Nadpis (\n pro zalomení)" "Podnadpis"
let args = CommandLine.arguments
let mode = args[1], inPath = args[2], outPath = args[3], headline = args[4], sub = args[5]
let W = 1080, H = 1920

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor { NSColor(deviceRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a) }
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let gctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = gctx
let ctx = gctx.cgContext

// pozadí: tmavý přechod značky + jemná záře
NSGradient(colors: [rgb(0x0d0f12), rgb(0x123b2d), rgb(0x0f4a38)], atLocations: [0, 0.62, 1], colorSpace: .deviceRGB)!.draw(in: NSRect(x: 0, y: 0, width: W, height: H), angle: -62)
NSGradient(colors: [rgb(0x4ae0a0, 0.30), rgb(0x4ae0a0, 0)])!.draw(fromCenter: NSPoint(x: 160, y: CGFloat(H) - 120), radius: 0, toCenter: NSPoint(x: 160, y: CGFloat(H) - 120), radius: 760, options: [])
NSGradient(colors: [rgb(0x4ae0a0, 0.14), rgb(0x4ae0a0, 0)])!.draw(fromCenter: NSPoint(x: 980, y: 380), radius: 0, toCenter: NSPoint(x: 980, y: 380), radius: 620, options: [])

// nadpis a podnadpis (zarovnáno na střed)
let para = NSMutableParagraphStyle(); para.alignment = .center; para.lineSpacing = 4
func drawText(_ s: String, y: CGFloat, size: CGFloat, weight: NSFont.Weight, color: NSColor, kern: CGFloat = 0, height: CGFloat) {
    let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color, .kern: kern, .paragraphStyle: para]
    NSAttributedString(string: s, attributes: attrs).draw(in: NSRect(x: 50, y: y, width: CGFloat(W) - 100, height: height))
}
let lines = headline.split(separator: "\n").count
let headH = CGFloat(lines) * 92
drawText(headline, y: CGFloat(H) - 78 - headH, size: 80, weight: .heavy, color: rgb(0xf6f7f8), kern: -2, height: headH)
drawText(sub, y: CGFloat(H) - 78 - headH - 62, size: 35, weight: .medium, color: rgb(0x4ae0a0), height: 50)

let shot = NSImage(contentsOfFile: inPath)!
let sw = shot.size.width, sh = shot.size.height

if mode == "phone" {
    // telefon: zaoblený rám, snímek uvnitř, přetéká přes spodní okraj
    let screenW: CGFloat = 800
    let screenH = screenW * sh / sw
    let bezel: CGFloat = 16
    let phoneW = screenW + bezel * 2
    let x = (CGFloat(W) - phoneW) / 2
    let topY = CGFloat(H) - 78 - headH - 62 - 70   // horní okraj telefonu (souřadnice zdola)
    let phoneRect = NSRect(x: x, y: topY - screenH - bezel * 2, width: phoneW, height: screenH + bezel * 2)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: 26), blur: 70, color: NSColor.black.withAlphaComponent(0.55).cgColor)
    rgb(0x0a0b0d).setFill()
    NSBezierPath(roundedRect: phoneRect, xRadius: 84, yRadius: 84).fill()
    ctx.restoreGState()
    rgb(0x30343b).setStroke()
    let edge = NSBezierPath(roundedRect: phoneRect.insetBy(dx: 1, dy: 1), xRadius: 83, yRadius: 83); edge.lineWidth = 2; edge.stroke()
    let screenRect = NSRect(x: x + bezel, y: phoneRect.minY + bezel, width: screenW, height: screenH)
    ctx.saveGState()
    NSBezierPath(roundedRect: screenRect, xRadius: 68, yRadius: 68).addClip()
    shot.draw(in: screenRect)
    // vlastní stavový řádek: původní z emulátoru zasahuje do zaoblených rohů, tady má bezpečné okraje
    if let tiff = shot.tiffRepresentation, let bmp = NSBitmapImageRep(data: tiff), let sample = bmp.colorAt(x: Int(sw) / 2, y: 30) {
        let k = screenW / sw
        let barH = 66 * k
        let bar = NSRect(x: screenRect.minX, y: screenRect.maxY - barH, width: screenW, height: barH)
        sample.setFill(); bar.fill()
        var lum: CGFloat = 0.5
        if let c = sample.usingColorSpace(.deviceRGB) { lum = 0.299 * c.redComponent + 0.587 * c.greenComponent + 0.114 * c.blueComponent }
        let ink = lum > 0.5 ? rgb(0x16181b) : rgb(0xf1f2f4)
        let midY = bar.midY
        let timeAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 25, weight: .semibold), .foregroundColor: ink]
        NSAttributedString(string: "9:41", attributes: timeAttrs).draw(at: NSPoint(x: screenRect.minX + 52, y: midY - 15))
        // baterie
        let bx = screenRect.maxX - 52 - 44
        ink.withAlphaComponent(0.45).setStroke()
        let body = NSBezierPath(roundedRect: NSRect(x: bx, y: midY - 11, width: 44, height: 22), xRadius: 6, yRadius: 6); body.lineWidth = 2; body.stroke()
        ink.setFill()
        NSBezierPath(roundedRect: NSRect(x: bx + 3.5, y: midY - 7.5, width: 37, height: 15), xRadius: 3.5, yRadius: 3.5).fill()
        NSBezierPath(roundedRect: NSRect(x: bx + 46, y: midY - 4, width: 3.5, height: 8), xRadius: 1.5, yRadius: 1.5).fill()
        // Wi-Fi
        let wx = bx - 22 - 30, wy = midY - 11
        ink.setStroke()
        for (i, r) in [CGFloat(8), 15, 22].enumerated() {
            let arc = NSBezierPath()
            arc.appendArc(withCenter: NSPoint(x: wx + 15, y: wy), radius: r, startAngle: 45, endAngle: 135)
            arc.lineWidth = 3; arc.lineCapStyle = .round; arc.stroke()
            _ = i
        }
        ink.setFill(); NSBezierPath(ovalIn: NSRect(x: wx + 12.5, y: wy - 3, width: 5, height: 5)).fill()
        // signál
        let sx = wx - 20 - 32
        for i in 0..<4 {
            let h = CGFloat(8 + i * 5)
            NSBezierPath(roundedRect: NSRect(x: sx + CGFloat(i) * 9, y: midY - 11, width: 6, height: h), xRadius: 1.5, yRadius: 1.5).fill()
        }
    }
    ctx.restoreGState()
    // kamera
    rgb(0x050607).setFill()
    NSBezierPath(ovalIn: NSRect(x: CGFloat(W) / 2 - 15, y: screenRect.maxY - 37, width: 30, height: 30)).fill()
} else if mode == "stack" {
    // dvě oznámení pod sebou jako samostatné karty, vycentrované do zbývajícího místa
    let shot2 = NSImage(contentsOfFile: args[6])!
    let cw: CGFloat = 960
    let h1 = cw * sh / sw, h2 = cw * shot2.size.height / shot2.size.width
    let gap: CGFloat = 40
    let areaTop = CGFloat(H) - 78 - headH - 62 - 40
    let total = h1 + gap + h2
    let startY = areaTop - (areaTop - total) / 2 - total * 0 // vršek bloku
    let top = areaTop - (areaTop - total) / 2
    _ = startY
    func card(_ img: NSImage, y: CGFloat, h: CGFloat) {
        let r = NSRect(x: (CGFloat(W) - cw) / 2, y: y, width: cw, height: h)
        ctx.saveGState()
        ctx.setShadow(offset: CGSize(width: 0, height: 22), blur: 56, color: NSColor.black.withAlphaComponent(0.5).cgColor)
        rgb(0xe9ebf3).setFill()
        NSBezierPath(roundedRect: r, xRadius: 48, yRadius: 48).fill()
        ctx.restoreGState()
        ctx.saveGState()
        NSBezierPath(roundedRect: r, xRadius: 48, yRadius: 48).addClip()
        img.draw(in: r)
        ctx.restoreGState()
    }
    card(shot, y: top - h1, h: h1)
    card(shot2, y: top - h1 - gap - h2, h: h2)
} else {
    // karta: oříznutý výřez (např. oznámení) jako velká karta se stínem
    let cardW: CGFloat = 960
    let cardH = cardW * sh / sw
    let topY = CGFloat(H) - 78 - headH - 62 - 90
    let r = NSRect(x: (CGFloat(W) - cardW) / 2, y: topY - cardH, width: cardW, height: cardH)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: 24), blur: 60, color: NSColor.black.withAlphaComponent(0.5).cgColor)
    rgb(0xffffff).setFill()
    NSBezierPath(roundedRect: r, xRadius: 54, yRadius: 54).fill()
    ctx.restoreGState()
    ctx.saveGState()
    NSBezierPath(roundedRect: r, xRadius: 54, yRadius: 54).addClip()
    shot.draw(in: r)
    ctx.restoreGState()
}
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: outPath))

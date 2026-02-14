# PWA Icons Requirements

This document specifies the icon files needed for proper PWA (Progressive Web App) support.

## Required Icon Files

### Standard PWA Icons

1. **`icon-192.png`** - 192×192 pixels
   - Format: PNG
   - Purpose: Standard PWA icon (any maskable)
   - Used by: Android home screen, app drawer
   - Background: Transparent or white (#ffffff)
   - Design: EAC logo centered with padding

2. **`icon-512.png`** - 512×512 pixels
   - Format: PNG
   - Purpose: High-resolution PWA icon (any maskable)
   - Used by: Android splash screen, larger displays
   - Background: Transparent or white (#ffffff)
   - Design: EAC logo centered with padding

3. **`apple-touch-icon.png`** - 180×180 pixels
   - Format: PNG
   - Purpose: iOS home screen icon (fallback/default)
   - Background: Should NOT be transparent (use white #ffffff or brand color)
   - Design: EAC logo centered with padding
   - Note: This should be the same as or a copy of `apple-touch-icon-180.png`

## Current Icon Status

✅ **Already present:**
- `apple-touch-icon-152.png` (152×152) - iOS iPad 2 and iPad mini
- `apple-touch-icon-167.png` (167×167) - iOS iPad Pro
- `apple-touch-icon-180.png` (180×180) - iOS iPhone (Retina)
- `favicon.png` - Browser favicon

❌ **Missing (to create):**
- `icon-192.png` - 192×192 PWA icon
- `icon-512.png` - 512×512 PWA icon
- `apple-touch-icon.png` - 180×180 default Apple touch icon

## Design Guidelines

### Brand Colors
- Primary: `#3b82f6` (blue) - for general UI
- Theme: `#C41425` (red) - EAC brand color
- Background: `#ffffff` (white)
- Text/Logo: Use brand red or white depending on background

### Icon Safe Zone
For maskable icons (Android), ensure important content is within the central 80% circle.
- **192×192**: Keep logo within ~154px diameter circle (center)
- **512×512**: Keep logo within ~410px diameter circle (center)

### File Preparation Checklist
- [ ] Export at exact dimensions (no scaling)
- [ ] Use PNG format with 8-bit or 24-bit color depth
- [ ] Optimize file size (use tools like ImageOptim, TinyPNG)
- [ ] Test transparency or solid background
- [ ] Verify safe zone for maskable icons

## How to Generate Icons

### Option 1: Using Existing Apple Icons
Since `apple-touch-icon-180.png` already exists, you can:
1. Copy it to `apple-touch-icon.png` (same file)
2. Upscale it to create `icon-192.png` and `icon-512.png` using an image editor
3. Add padding/safe zone if needed for maskable support

### Option 2: From Source Logo
If you have the original EAC logo (SVG or high-res PNG):
1. Use an icon generator like [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
2. Or manually create in design tools (Figma, Photoshop, GIMP)
3. Export at required sizes with proper padding

### Option 3: Online PWA Icon Generator
Use a tool like:
- https://www.pwabuilder.com/imageGenerator
- https://realfavicongenerator.net/
- Upload your logo and download the generated icon set

## Validation

After creating icons:
1. Check file sizes are reasonable (<50KB for 192px, <100KB for 512px)
2. Verify dimensions with: `file icon-*.png` or image viewer
3. Test in Lighthouse PWA audit
4. Test on actual devices (Android home screen, iOS home screen)

## References
- [PWA Icon Requirements (web.dev)](https://web.dev/articles/add-manifest#icons)
- [Apple Touch Icon Specifications](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Maskable Icons](https://web.dev/articles/maskable-icon)

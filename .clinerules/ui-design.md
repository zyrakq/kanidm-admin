## Brief overview

UI/UX design guidelines for Kanidm Admin interface. Minimalist, clean design inspired by Authentik.

## Color palette (Light theme)

- **Primary**: `#FF6B35` (Kanidm orange)
- **Primary hover**: `#E85D2A`
- **Primary active**: `#D94E1F`
- **Background**: `#F9FAFB` (light gray)
- **Surface**: `#FFFFFF` (white)
- **Text primary**: `#1F2937`
- **Text secondary**: `#6B7280`
- **Text muted**: `#9CA3AF`
- **Border**: `#E5E7EB`
- **Success**: `#10B981` (green)

## Design principles

- Minimalism - no gradients on backgrounds, no excessive shadows
- Clean spacing - adequate padding and margins
- Simple shadows - `box-shadow: 0 1px 3px rgba(0,0,0,0.12)` for cards
- Rounded corners - `border-radius: 6-8px` (not too large)
- Flat design - no 3D effects, gradients only for subtle accents if needed

## Component standards

- **Buttons**: Orange background, no shadows, 6px radius, 500 font-weight
- **Cards**: White background, minimal shadow, 8px radius
- **Logo sizes**: Header 48px, Auth card 120px
- **Typography**: System fonts stack, 600 weight for headings, 500 for semi-bold

## Layout structure

- Header with logo (48px) and app name
- Content area with light gray background
- Simple footer with links and status

## Future considerations

- Dark theme will be added later (not implemented yet)
- Theme switcher placeholder exists in header

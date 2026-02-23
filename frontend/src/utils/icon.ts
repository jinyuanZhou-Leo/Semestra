// input:  [icon values coming from plugin metadata or runtime props]
// output: [`isImageIcon()` type guard for image-like icon strings]
// pos:    [Utility that routes icon rendering between `<img>` and ReactNode paths]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

export const isImageIcon = (icon: unknown): icon is string => {
    if (typeof icon !== 'string') return false;
    const trimmed = icon.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:')) return true;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
    return /\.(png|jpe?g|svg|webp|gif)(\?.*)?$/i.test(trimmed);
};

export const isImageIcon = (icon: unknown): icon is string => {
    if (typeof icon !== 'string') return false;
    const trimmed = icon.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('data:')) return true;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) return true;
    return /\.(png|jpe?g|svg|webp|gif)(\?.*)?$/i.test(trimmed);
};

/**
 * Returns a CSS gradient string that mimics an aurora/mesh flow.
 * Uses a multi-layered radial gradient with background animation.
 */
export const useHeroGradient = () => {
    // True Mesh Gradient Logic:
    // We use multiple radial gradients positioned around the container.
    // They move using the 'aurora-flow' keyframes which shifts background-position.
    // Colors are pulled from CSS variables to handle Light/Dark mode automatically.

    return {
        background: `
            radial-gradient(circle at 15% 50%, var(--mesh-color-1) 0%, transparent 25%), 
            radial-gradient(circle at 85% 30%, var(--mesh-color-2) 0%, transparent 25%), 
            radial-gradient(circle at 50% 50%, var(--mesh-color-3) 0%, transparent 50%),
            var(--gradient-hero)
        `,
        backgroundSize: '200% 200%, 200% 200%, 200% 200%, 100% 100%',
        animation: 'aurora-flow 10s ease infinite',
        borderBottom: '1px solid var(--color-border)',
    };
};

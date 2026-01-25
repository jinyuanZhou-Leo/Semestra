import { motion } from 'framer-motion';

const Loading = () => {
    return (
        <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-bg-primary">
            {/* Animated Mesh Gradient Background */}
            <div className="absolute inset-0 opacity-30 dark:opacity-20">
                <div
                    className="absolute top-[-20%] left-[-10%] h-[70vh] w-[70vh] rounded-full mix-blend-multiply blur-[80px] filter dark:mix-blend-screen"
                    style={{
                        backgroundColor: 'var(--mesh-color-1)',
                        animation: 'blob 10s infinite',
                    }}
                />
                <div
                    className="absolute top-[-20%] right-[-10%] h-[70vh] w-[70vh] rounded-full mix-blend-multiply blur-[80px] filter dark:mix-blend-screen"
                    style={{
                        backgroundColor: 'var(--mesh-color-2)',
                        animation: 'blob 10s infinite 2s',
                    }}
                />
                <div
                    className="absolute bottom-[-20%] left-[20%] h-[70vh] w-[70vh] rounded-full mix-blend-multiply blur-[80px] filter dark:mix-blend-screen"
                    style={{
                        backgroundColor: 'var(--mesh-color-3)',
                        animation: 'blob 10s infinite 4s',
                    }}
                />
            </div>

            <div className="relative z-10 flex flex-col items-center">
                {/* Animated Logo/Spinner */}
                <motion.div
                    className="mb-8 flex items-center justify-center"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    <div className="relative h-16 w-16">
                        <motion.div
                            className="absolute inset-0 rounded-xl bg-gradient-to-tr from-primary to-purple-500 opacity-20 blur-lg"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.2, 0.4, 0.2],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                        <motion.div
                            className="relative h-16 w-16 rounded-xl bg-gradient-to-tr from-primary to-purple-400 shadow-lg"
                            animate={{
                                rotate: 360,
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "linear"
                            }}
                        >
                            <div className="absolute inset-[3px] rounded-[10px] bg-bg-primary" />
                            <div className="absolute inset-[6px] rounded-[7px] bg-gradient-to-tr from-primary/20 to-purple-400/20 backdrop-blur-sm" />
                        </motion.div>
                    </div>
                </motion.div>

                {/* Text Reveal */}
                <div className="overflow-hidden">
                    <motion.h1
                        className="bg-gradient-to-br from-text-primary to-text-secondary bg-clip-text text-3xl font-bold tracking-tight text-transparent"
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    >
                        Semestra
                    </motion.h1>
                    <motion.div
                        className="mt-2 flex justify-center gap-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                className="h-1.5 w-1.5 rounded-full bg-primary/50"
                                animate={{
                                    y: [0, -6, 0],
                                    backgroundColor: ['var(--color-primary)', 'var(--color-accent-hover)', 'var(--color-primary)']
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                }}
                            />
                        ))}
                    </motion.div>
                </div>
            </div>

            {/* Styles for the blob animation */}
            <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>
        </div>
    );
};

export default Loading;

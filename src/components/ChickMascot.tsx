import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export function ChickMascot({ size = 1 }: { size?: number }) {
    const [wave, setWave] = useState(false);

    useEffect(() => {
        const w = setInterval(() => {
            setWave(true);
            setTimeout(() => setWave(false), 800);
        }, 5000);
        return () => clearInterval(w);
    }, []);

    const W = 110 * size;

    return (
        <motion.div
            style={{ width: W, position: 'relative', display: 'inline-block' }}
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
            whileHover={{ scale: 1.08 }}
        >
            {/* Sparkles around */}
            <motion.span
                style={{ position: 'absolute', top: -8, right: -4, fontSize: 14 * size, zIndex: 10 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1.3, 0.4], rotate: [0, 20, 0] }}
                transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
            >✨</motion.span>
            <motion.span
                style={{ position: 'absolute', top: 20, left: -10, fontSize: 10 * size, zIndex: 10 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 0.4] }}
                transition={{ repeat: Infinity, duration: 3.2, delay: 1.5 }}
            >⭐</motion.span>
            <motion.span
                style={{ position: 'absolute', bottom: 20, right: -8, fontSize: 10 * size, zIndex: 10 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1.0, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.8, delay: 2.2 }}
            >💛</motion.span>

            {/* Left wing overlay — animate on top of left edge of image */}
            <motion.div
                style={{
                    position: 'absolute',
                    bottom: '28%',
                    left: -6 * size,
                    width: 20 * size,
                    height: 24 * size,
                    background: 'radial-gradient(ellipse at 40% 30%, #FFE97A, #FFC200)',
                    borderRadius: '60% 40% 60% 40%',
                    zIndex: 2,
                    transformOrigin: 'right center',
                    filter: 'blur(1px)',
                }}
                animate={wave
                    ? { rotate: [-35, 15, -35, 15, 0] }
                    : { rotate: [-8, 8, -8] }
                }
                transition={wave
                    ? { duration: 0.7 }
                    : { repeat: Infinity, duration: 3.5, ease: 'easeInOut' }
                }
            />

            {/* Right wing overlay */}
            <motion.div
                style={{
                    position: 'absolute',
                    bottom: '28%',
                    right: -6 * size,
                    width: 20 * size,
                    height: 24 * size,
                    background: 'radial-gradient(ellipse at 60% 30%, #FFE97A, #FFC200)',
                    borderRadius: '40% 60% 40% 60%',
                    zIndex: 2,
                    transformOrigin: 'left center',
                    filter: 'blur(1px)',
                }}
                animate={wave
                    ? { rotate: [35, -15, 35, -15, 0] }
                    : { rotate: [8, -8, 8] }
                }
                transition={wave
                    ? { duration: 0.7, delay: 0.04 }
                    : { repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.2 }
                }
            />

            {/* The actual mascot image */}
            <img
                src="/chick_mascot.png"
                alt="Chick Mascot"
                style={{
                    width: '100%',
                    display: 'block',
                    position: 'relative',
                    zIndex: 3,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    mixBlendMode: 'multiply',
                }}
                draggable={false}
            />

            {/* Ground shadow */}
            <div style={{
                width: '55%',
                height: 8,
                margin: '0 auto',
                background: 'radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 75%)',
                marginTop: -4,
            }} />
        </motion.div>
    );
}

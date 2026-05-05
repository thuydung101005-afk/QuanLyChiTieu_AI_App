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

    const W = 180 * size;

    return (
        <motion.div
            style={{ width: W, position: 'relative', display: 'inline-block' }}
            whileHover={{ scale: 1.05 }}
        >
            <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                style={{ position: 'relative', zIndex: 3 }}
            >
                <img
                    src="/chick_mascot.png"
                    alt="Chick Mascot"
                    style={{
                        width: '100%',
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                    }}
                    draggable={false}
                />
            </motion.div>

            {/* Ground shadow */}
            <motion.div 
                style={{
                    width: '60%',
                    height: 12,
                    margin: '0 auto',
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)',
                    marginTop: '-18%', // Pull shadow up to cover transparent gap in user image
                    position: 'relative',
                    zIndex: 1,
                }}
                animate={{ scale: [1, 0.75, 1], opacity: [0.8, 0.3, 0.8] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
            />
        </motion.div>
    );
}

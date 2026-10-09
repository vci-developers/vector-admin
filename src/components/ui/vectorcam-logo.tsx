import { cn } from '@/utils/cn';
import Image from 'next/image';

/**
 * The VectorCam "VC" mark, its black C made white on the dark theme. Height
 * comes from `className` (e.g. `h-7`); the width follows.
 */
export default function VectorCamLogo({ className }: { className?: string }) {
    const common = 'w-auto';
    return (
        <>
            <Image
                src="/vectorcam-logo.png"
                alt="VectorCam"
                width={145}
                height={112}
                priority
                className={cn(common, 'dark:hidden', className)}
            />
            <Image
                src="/vectorcam-logo-dark.png"
                alt="VectorCam"
                width={145}
                height={112}
                priority
                className={cn(common, 'hidden dark:block', className)}
            />
        </>
    );
}

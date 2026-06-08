// Lightweight background particle field. Heavy work (line connections, mouse
// physics) is disabled on mobile / reduced-motion users / hidden tabs.
const Particles = {
    canvas: null,
    ctx: null,
    particles: [],
    raf: null,
    enabled: true,
    drawConnections: false,
    drawMouse: true,
    count: 25,

    init() {
        this.canvas = document.getElementById('particles-canvas');
        if (!this.canvas) return;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isMobile = window.matchMedia('(max-width: 768px)').matches
            || (navigator.maxTouchPoints || 0) > 1;
        const lowMem = ((navigator as any).deviceMemory || 4) <= 2;

        // On mobile / reduced-motion / low-RAM devices: skip particles entirely.
        if (reducedMotion || lowMem || isMobile) {
            this.enabled = false;
            this.canvas.style.display = 'none';
            return;
        }

        this.ctx = this.canvas.getContext('2d', { alpha: true });
        this.mouse = { x: -1000, y: -1000 };

        this.resize();
        this.create();
        this.animate();

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { this.resize(); this.create(); }, 200);
        });

        if (this.drawMouse) {
            // Throttle mousemove to ~30 Hz. High-rate gaming mice can fire
            // 240+ events/sec; nothing here benefits from that frequency.
            let mmTick = 0;
            window.addEventListener('mousemove', (e) => {
                const now = e.timeStamp || performance.now();
                if (now - mmTick < 33) return;
                mmTick = now;
                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
            }, { passive: true });
        }

        // Pause when tab hidden — saves battery.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.raf) cancelAnimationFrame(this.raf);
                this.raf = null;
            } else if (!this.raf) {
                this.animate();
            }
        });
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    create() {
        this.particles = [];
        const colors = [
            'rgba(139, 92, 246, ',
            'rgba(236, 72, 153, ',
            'rgba(59, 130, 246, ',
            'rgba(255, 255, 255, ',
        ];
        for (let i = 0; i < this.count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 1.6 + 0.6,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.4 + 0.15,
                pulse: Math.random() * Math.PI * 2,
                pulseSpeed: Math.random() * 0.02 + 0.005,
            });
        }
    },

    animate() {
        if (!this.enabled || !this.ctx) return;
        // Cap ambient particle field at ~30fps. Halves the per-frame CPU
        // cost on desktops without any perceptible visual change.
        const tNow = performance.now();
        if (this._lastFrame && tNow - this._lastFrame < 32) {
            this.raf = requestAnimationFrame(() => this.animate());
            return;
        }
        this._lastFrame = tNow;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const ps = this.particles;
        const drawConnections = this.drawConnections;
        const drawMouse = this.drawMouse;
        const mx = this.mouse.x;
        const my = this.mouse.y;

        for (let i = 0; i < ps.length; i++) {
            const p = ps[i];
            p.pulse += p.pulseSpeed;
            const alpha = p.alpha + Math.sin(p.pulse) * 0.12;

            if (drawMouse) {
                const dx = p.x - mx;
                const dy = p.y - my;
                const distSq = dx * dx + dy * dy;
                if (distSq < 14400) {
                    const dist = Math.sqrt(distSq) || 1;
                    const force = (120 - dist) / 120;
                    p.vx += (dx / dist) * force * 0.3;
                    p.vy += (dy / dist) * force * 0.3;
                }
            }

            p.vx *= 0.99;
            p.vy *= 0.99;
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < -10) p.x = w + 10;
            else if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10;
            else if (p.y > h + 10) p.y = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, 6.28318);
            ctx.fillStyle = p.color + (alpha > 0 ? alpha.toFixed(2) : '0') + ')';
            ctx.fill();
        }

        if (drawConnections) {
            ctx.lineWidth = 0.5;
            for (let i = 0; i < ps.length; i++) {
                const p = ps[i];
                for (let j = i + 1; j < ps.length; j++) {
                    const p2 = ps[j];
                    const cdx = p.x - p2.x;
                    const cdy = p.y - p2.y;
                    const cdistSq = cdx * cdx + cdy * cdy;
                    if (cdistSq < 10000) {
                        const lineAlpha = (1 - Math.sqrt(cdistSq) / 100) * 0.08;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(139, 92, 246, ${lineAlpha})`;
                        ctx.stroke();
                    }
                }
            }
        }

        this.raf = requestAnimationFrame(() => this.animate());
    },

    destroy() {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
    },
};

// @ts-nocheck
const Analytics = {
    sessionId: '',
    enabled: false,
    heatmapEnabled: false,
    sessionRecordingEnabled: false,
    funnelEnabled: false,
    events: [],
    recordingData: [],
    isRecording: false,
    init() {
        this.enabled = API.siteSettings?.analytics_enabled || false;
        this.heatmapEnabled = API.siteSettings?.analytics_heatmap_enabled || false;
        this.sessionRecordingEnabled = API.siteSettings?.analytics_session_recording_enabled || false;
        this.funnelEnabled = API.siteSettings?.analytics_funnel_enabled || false;
        if (!this.enabled)
            return;
        this.sessionId = this.getOrCreateSessionId();
        this.trackEvent('page_view', { url: location.href, referrer: document.referrer });
        if (this.funnelEnabled) {
            this.trackFunnel('visit');
        }
        if (this.heatmapEnabled) {
            this.initHeatmapTracking();
        }
        if (this.sessionRecordingEnabled) {
            this.initSessionRecording();
        }
    },
    getOrCreateSessionId() {
        let sid = sessionStorage.getItem('picksy_session_id');
        if (!sid) {
            sid = 'ps_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('picksy_session_id', sid);
        }
        return sid;
    },
    trackEvent(eventType, data = null) {
        if (!this.enabled)
            return;
        const payload = {
            session_id: this.sessionId,
            event_type: eventType,
            data: data,
            page_url: location.href,
            referrer: document.referrer,
        };
        navigator.sendBeacon(`${CONFIG.API_URL}/api/analytics/event`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    },
    trackFunnel(step) {
        if (!this.funnelEnabled)
            return;
        const payload = {
            session_id: this.sessionId,
            step: step,
        };
        navigator.sendBeacon(`${CONFIG.API_URL}/api/analytics/funnel`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    },
    initHeatmapTracking() {
        let clickBuffer = [];
        let flushTimer = null;
        document.addEventListener('click', (e) => {
            const target = e.target;
            let selector = '';
            if (target.id)
                selector = '#' + target.id;
            else if (target.className && typeof target.className === 'string')
                selector = '.' + target.className.split(' ')[0];
            else
                selector = target.tagName.toLowerCase();
            clickBuffer.push({
                session_id: this.sessionId,
                user_id: Auth.user?.id || null,
                x: e.clientX,
                y: e.clientY,
                selector: selector,
                page_url: location.pathname,
                viewport_w: window.innerWidth,
                viewport_h: window.innerHeight,
            });
            if (!flushTimer) {
                flushTimer = setTimeout(() => {
                    clickBuffer.forEach(c => {
                        navigator.sendBeacon(`${CONFIG.API_URL}/api/analytics/click`, new Blob([JSON.stringify(c)], { type: 'application/json' }));
                    });
                    clickBuffer = [];
                    flushTimer = null;
                }, 2000);
            }
        }, { passive: true });
    },
    initSessionRecording() {
        this.isRecording = true;
        this.recordingData = [];
        const startTime = Date.now();
        const recordEvent = (type, data) => {
            this.recordingData.push({
                t: Date.now() - startTime,
                type: type,
                data: data,
            });
        };
        // Track mouse movements (throttled)
        let lastMove = 0;
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMove < 100)
                return;
            lastMove = now;
            recordEvent('mouse', { x: e.clientX, y: e.clientY });
        }, { passive: true });
        // Track clicks
        document.addEventListener('click', (e) => {
            const target = e.target;
            recordEvent('click', {
                x: e.clientX,
                y: e.clientY,
                tag: target.tagName,
                id: target.id || '',
                text: (target.textContent || '').substring(0, 50),
            });
        }, { passive: true });
        // Track scrolls (throttled)
        let lastScroll = 0;
        document.addEventListener('scroll', () => {
            const now = Date.now();
            if (now - lastScroll < 200)
                return;
            lastScroll = now;
            recordEvent('scroll', { y: window.scrollY, maxY: document.body.scrollHeight });
        }, { passive: true });
        // Track input focus
        document.addEventListener('focus', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
                recordEvent('focus', { tag: target.tagName, id: target.id || '' });
            }
        }, true);
        // Flush recording data periodically
        setInterval(() => {
            if (this.recordingData.length > 0) {
                const batch = this.recordingData.splice(0, 100);
                this.trackEvent('session_recording', {
                    session_id: this.sessionId,
                    events: batch,
                    viewport: { w: window.innerWidth, h: window.innerHeight },
                    url: location.href,
                });
            }
        }, 10000);
        // Flush on page unload
        window.addEventListener('beforeunload', () => {
            if (this.recordingData.length > 0) {
                this.trackEvent('session_recording', {
                    session_id: this.sessionId,
                    events: this.recordingData,
                    viewport: { w: window.innerWidth, h: window.innerHeight },
                    url: location.href,
                });
            }
        });
    },
    onRegister() {
        this.trackEvent('register');
        this.trackFunnel('register');
    },
    onFirstPick() {
        this.trackEvent('first_pick');
        this.trackFunnel('first_pick');
    },
    onActive() {
        this.trackFunnel('active');
    },
    trackButtonClick(btnId, label = '') {
        this.trackEvent('button_click', { button: btnId, label: label });
    },
    trackPick(type, title = '') {
        this.trackEvent('pick', { type: type, title: title });
    },
    trackSave(type, title = '') {
        this.trackEvent('save', { type: type, title: title });
    },
};
//# sourceMappingURL=analytics.js.map
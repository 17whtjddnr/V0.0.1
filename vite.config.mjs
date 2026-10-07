export default {
    server: {
        watch: {
            // Windows can temporarily lock SVG files while they are copied.
            usePolling: true,
            interval: 500,
            binaryInterval: 1000,
            ignored: ['**/data/*-build-temp/**', '**/data/*-tools/**'],
        },
    },
};

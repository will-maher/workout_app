const os = require('os');

// Memory monitoring utility
function logMemoryUsage() {
  const used = process.memoryUsage();
  const total = os.totalmem();
  const free = os.freemem();
  
  const formatBytes = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };
  
  console.log('Memory Usage:', {
    rss: formatBytes(used.rss), // Resident Set Size
    heapTotal: formatBytes(used.heapTotal),
    heapUsed: formatBytes(used.heapUsed),
    external: formatBytes(used.external),
    systemTotal: formatBytes(total),
    systemFree: formatBytes(free)
  });
}

// Log memory usage every 5 minutes in production
if (process.env.NODE_ENV === 'production') {
  setInterval(logMemoryUsage, 5 * 60 * 1000);
}

module.exports = { logMemoryUsage };

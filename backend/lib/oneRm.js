// Shared 1RM estimation: Brzycki formula + LOESS smoothing over the
// daily-max 1RM series. Mirrors the calculation used on the frontend
// Performance tab so estimates agree everywhere.

const calcOneRm = (weight, reps) => weight / (1.0278 - 0.0278 * reps);

function loess(xs, ys, bandwidth = 0.08) {
  const n = xs.length;
  const bw = Math.max(2, Math.floor(bandwidth * n));
  const result = [];
  for (let i = 0; i < n; i++) {
    const distances = xs.map(x => Math.abs(x - xs[i]));
    const idxs = distances
      .map((d, idx) => [d, idx])
      .sort((a, b) => a[0] - b[0])
      .slice(0, bw)
      .map(pair => pair[1]);
    const xw = idxs.map(j => xs[j]);
    const yw = idxs.map(j => ys[j]);
    const xbar = xw.reduce((a, b) => a + b, 0) / bw;
    const ybar = yw.reduce((a, b) => a + b, 0) / bw;
    const num = xw.reduce((sum, xj, k) => sum + (xj - xbar) * (yw[k] - ybar), 0);
    const den = xw.reduce((sum, xj) => sum + (xj - xbar) ** 2, 0);
    const beta = den === 0 ? 0 : num / den;
    const alpha = ybar - beta * xbar;
    result.push([xs[i], alpha + beta * xs[i]]);
  }
  return result;
}

// rows: [{ date: Date|string, weight, reps }] ordered by date ascending.
// Returns the LOESS-smoothed estimate of current 1RM (0 if no data).
function estimateCurrentOneRm(rows) {
  if (!rows || rows.length === 0) return 0;
  const points = rows.map(set => ({
    date: (typeof set.date === 'string') ? set.date.slice(0, 10) : set.date.toISOString().slice(0, 10),
    one_rm: calcOneRm(set.weight, set.reps),
  }));
  const byDate = {};
  points.forEach(pt => {
    if (!byDate[pt.date] || pt.one_rm > byDate[pt.date].one_rm) {
      byDate[pt.date] = pt;
    }
  });
  const dailyMax = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  if (dailyMax.length >= 3) {
    const xs = dailyMax.map(pt => new Date(pt.date).getTime());
    const ys = dailyMax.map(pt => pt.one_rm);
    const line = loess(xs, ys, 0.08);
    return line[line.length - 1][1];
  }
  return dailyMax[dailyMax.length - 1].one_rm;
}

module.exports = { calcOneRm, loess, estimateCurrentOneRm };

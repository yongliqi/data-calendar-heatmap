/* GA4 Conversion Alerts — Calendar Heatmap
 * Looker Studio Community Visualization
 * Compatible with: lookerstudio.google.com (free)
 *
 * Data source expected columns:
 *   query_date      — DATE dimension   (YYYYMMDD or YYYY-MM-DD)
 *   query_hour      — TEXT/NUMBER dim  (0–23)
 *   metric_value    — METRIC           (conversions sum)
 *   alert_triggered — METRIC           (MAX of alert flag, 0 or 1)
 */

(function() {
  'use strict';

  /* ── helpers ── */
  const dscc = window.dscc;

  /* color ramps */
  const RAMPS = {
    blue:  ['#E6F1FB','#B5D4F4','#85B7EB','#378ADD','#185FA5','#0C447C','#042C53'],
    green: ['#EAF3DE','#C0DD97','#97C459','#639922','#3B6D11','#27500A','#173404'],
    red:   ['#FCEBEB','#F7C1C1','#F09595','#E24B4A','#A32D2D','#791F1F','#501313']
  };

  function getColor(value, max, scheme) {
    const ramp = RAMPS[scheme] || RAMPS.blue;
    if (value == null || max === 0) return '#f1f0f0';
    const idx = Math.min(ramp.length - 1, Math.floor((value / max) * (ramp.length - 1)));
    return ramp[idx];
  }

  function parseDate(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/-/g, '');
    if (s.length === 8) {
      return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    }
    return String(raw);
  }

  /* ── main draw function ── */
  function drawViz(data) {
    const container = document.getElementById('container') || document.body;
    container.innerHTML = '';
    container.style.fontFamily = 'Google Sans, Arial, sans-serif';
    container.style.padding = '12px';
    container.style.boxSizing = 'border-box';
    container.style.overflow = 'auto';

    /* style config */
    const styleData   = data.style    || {};
    const scheme      = (styleData.colorScheme      && styleData.colorScheme.value)      || 'blue';
    const showAlerts  = (styleData.showAlerts        && styleData.showAlerts.value)        !== false;
    const showLegend  = (styleData.showLegend        && styleData.showLegend.value)        !== false;
    const alertColor  = (styleData.alertColor        && styleData.alertColor.value && styleData.alertColor.value.color) || '#E24B4A';
    const alertStart  = parseInt((styleData.alertWindowStart && styleData.alertWindowStart.value) || '7', 10);

    /* parse rows */
    const rows = data.tables.DEFAULT;
    if (!rows || rows.length === 0) {
      container.innerHTML = '<p style="color:#888;padding:20px">No data. Map: Date → query_date, Hour → query_hour, Metric → conversions.</p>';
      return;
    }

    /* build lookup: date → hour → {value, alert} */
    const lookup = {};
    const dates  = new Set();
    let maxVal   = 0;

    rows.forEach(row => {
      const date  = parseDate(row.query_date[0]);
      const hour  = parseInt(row.query_hour[0], 10);
      const value = parseFloat(row.metric_value[0]) || 0;
      const alert = row.alert_triggered && row.alert_triggered[0] == 1;

      if (!date || isNaN(hour)) return;
      if (!lookup[date]) lookup[date] = {};
      if (!lookup[date][hour]) lookup[date][hour] = { value: 0, alert: false };
      lookup[date][hour].value += value;
      if (alert) lookup[date][hour].alert = true;
      if (lookup[date][hour].value > maxVal) maxVal = lookup[date][hour].value;
      dates.add(date);
    });

    const sortedDates = Array.from(dates).sort();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    /* ── build DOM ── */
    const width = container.clientWidth || 700;
    const dateColW = 78;
    const cellSize = Math.max(14, Math.min(28, Math.floor((width - dateColW - 16) / 24)));
    const cellGap  = 2;

    /* title row */
    const title = document.createElement('div');
    title.style.cssText = 'font-size:13px;font-weight:500;color:#3c4043;margin-bottom:10px';
    title.textContent = 'Conversions by date × hour';
    container.appendChild(title);

    /* hour header */
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `display:flex;align-items:center;margin-bottom:${cellGap}px;margin-left:${dateColW}px`;
    hours.forEach(h => {
      const lbl = document.createElement('div');
      lbl.style.cssText = `width:${cellSize}px;margin-right:${cellGap}px;font-size:9px;color:#80868b;text-align:center;flex-shrink:0`;
      lbl.textContent = h % 3 === 0 ? h : '';
      headerRow.appendChild(lbl);
    });
    container.appendChild(headerRow);

    /* alert window indicator */
    if (showAlerts) {
      const alertBar = document.createElement('div');
      alertBar.style.cssText = `margin-left:${dateColW}px;margin-bottom:4px;display:flex;align-items:center`;
      const barInner = document.createElement('div');
      const leftPx = alertStart * (cellSize + cellGap);
      const widthPx = (24 - alertStart) * (cellSize + cellGap);
      barInner.style.cssText = `margin-left:${leftPx}px;width:${widthPx}px;height:3px;background:rgba(226,75,74,0.25);border-radius:2px`;
      alertBar.appendChild(barInner);
      container.appendChild(alertBar);
    }

    /* tooltip element */
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position:fixed;background:#3c4043;color:#fff;padding:6px 10px;
      border-radius:4px;font-size:11px;pointer-events:none;opacity:0;
      transition:opacity .15s;z-index:9999;white-space:nowrap;
    `;
    document.body.appendChild(tooltip);

    /* data rows */
    sortedDates.forEach(date => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;margin-bottom:${cellGap}px`;

      /* date label */
      const label = document.createElement('div');
      label.style.cssText = `width:${dateColW}px;font-size:10px;color:#5f6368;text-align:right;padding-right:8px;flex-shrink:0`;
      label.textContent = date.slice(5); /* MM-DD */
      row.appendChild(label);

      /* cells */
      hours.forEach(h => {
        const cell = document.createElement('div');
        const entry = lookup[date] && lookup[date][h];
        const val   = entry ? entry.value : null;
        const isAlert = showAlerts && entry && entry.alert && h >= alertStart;

        cell.style.cssText = `
          width:${cellSize}px;height:${cellSize}px;
          margin-right:${cellGap}px;
          border-radius:2px;
          cursor:default;
          flex-shrink:0;
          transition:transform .1s;
          background:${isAlert ? alertColor : getColor(val, maxVal, scheme)};
          ${isAlert ? `box-shadow:0 0 0 1px ${alertColor}44` : ''}
          ${val == null ? 'opacity:0.25' : ''}
        `;

        /* tooltip */
        cell.addEventListener('mouseenter', (e) => {
          const alertLabel = isAlert ? ' ⚠ ALERT' : '';
          tooltip.textContent = `${date} ${String(h).padStart(2,'0')}:00  —  ${val != null ? val : 'no data'}${alertLabel}`;
          tooltip.style.opacity = '1';
        });
        cell.addEventListener('mousemove', (e) => {
          tooltip.style.left = (e.clientX + 12) + 'px';
          tooltip.style.top  = (e.clientY - 28) + 'px';
        });
        cell.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
        });

        /* click → filter interaction */
        cell.addEventListener('click', () => {
          if (dscc && dscc.sendInteraction) {
            dscc.sendInteraction('onClick', 'FILTER', {
              data: [{ concepts: ['query_date','query_hour'], values: [[date, String(h)]] }]
            });
          }
        });

        row.appendChild(cell);
      });

      container.appendChild(row);
    });

    /* legend */
    if (showLegend) {
      const legend = document.createElement('div');
      legend.style.cssText = 'display:flex;align-items:center;gap:16px;margin-top:12px;flex-wrap:wrap';

      const ramp = RAMPS[scheme] || RAMPS.blue;
      const labels = ['0', 'low', '', 'mid', '', 'high', 'max'];
      const legendTitle = document.createElement('span');
      legendTitle.style.cssText = 'font-size:10px;color:#80868b';
      legendTitle.textContent = 'value:';
      legend.appendChild(legendTitle);

      ramp.forEach((color, i) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:4px';
        const sq = document.createElement('div');
        sq.style.cssText = `width:12px;height:12px;border-radius:2px;background:${color}`;
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:10px;color:#80868b';
        lbl.textContent = labels[i] || '';
        item.appendChild(sq);
        if (labels[i]) item.appendChild(lbl);
        legend.appendChild(item);
      });

      if (showAlerts) {
        const alertItem = document.createElement('div');
        alertItem.style.cssText = 'display:flex;align-items:center;gap:4px;margin-left:8px';
        const sq = document.createElement('div');
        sq.style.cssText = `width:12px;height:12px;border-radius:2px;background:${alertColor}`;
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:10px;color:#80868b';
        lbl.textContent = '⚠ alert';
        alertItem.appendChild(sq);
        alertItem.appendChild(lbl);
        legend.appendChild(alertItem);
      }

      container.appendChild(legend);
    }
  }

  /* ── bootstrap ── */
  if (typeof dscc !== 'undefined' && dscc.subscribeToData) {
    /* running inside Looker Studio */
    dscc.subscribeToData(drawViz, { transform: dscc.objectTransform });
  } else {
    /* running standalone for testing — inject mock data */
    const mockRows = [];
    const today = new Date();
    for (let d = 8; d >= 0; d--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - d);
      const dateStr = dt.toISOString().slice(0, 10);
      for (let h = 0; h < 24; h++) {
        const val = h < 7 ? Math.floor(Math.random() * 20) : Math.floor(Math.random() * 150) + 10;
        const alert = h >= 7 && val < 30 && Math.random() < 0.15;
        mockRows.push({
          query_date:      [dateStr],
          query_hour:      [String(h)],
          metric_value:    [val],
          alert_triggered: [alert ? 1 : 0]
        });
      }
    }
    drawViz({
      tables: { DEFAULT: mockRows },
      style: {
        colorScheme:      { value: 'blue' },
        showAlerts:       { value: true },
        showLegend:       { value: true },
        alertColor:       { value: { color: '#E24B4A' } },
        alertWindowStart: { value: '7' }
      }
    });
  }

})();

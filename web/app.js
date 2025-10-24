// Global variables
let resultsData = [];
let lapsData = [];
let selectedRunners = new Set();
let chart = null;
let sortColumn = null;
let sortDirection = 'asc';

// Color palette for multiple runners
const colorPalette = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
];

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    renderTable();
    setupEventListeners();
    initChart();
    setupResizer();
});

// Load data from JSON files
async function loadData() {
    try {
        const [resultsResponse, lapsResponse] = await Promise.all([
            fetch('/data/results.json'),
            fetch('/data/laps.json')
        ]);

        resultsData = await resultsResponse.json();
        lapsData = await lapsResponse.json();

        console.log('Results loaded:', resultsData.length);
        console.log('Laps loaded:', lapsData.length);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Render table
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    // Sort data only if a sort column is selected
    const sortedData = sortColumn ? [...resultsData].sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        // Handle numeric vs string sorting
        if (typeof aVal === 'number' || !isNaN(aVal)) {
            aVal = Number(aVal) || 0;
            bVal = Number(bVal) || 0;
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    }) : resultsData;

    // Render rows
    sortedData.forEach(runner => {
        const row = document.createElement('tr');
        row.dataset.bib = runner.Bib;
        row.classList.add('runner-row');

        if (selectedRunners.has(runner.Bib)) {
            row.classList.add('table-active');
        }

        row.innerHTML = `
            <td>${runner.Place}</td>
            <td>${runner.Bib}</td>
            <td>${runner.Name}</td>
            <td>${runner.Age}</td>
            <td>${runner.State}</td>
            <td>${runner.Laps}</td>
            <td>${runner.Miles}</td>
            <td>${runner.KM}</td>
            <td>${runner.RaceTime}</td>
        `;

        tbody.appendChild(row);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Table sorting
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }
            renderTable();
        });
    });

    // Row selection
    document.getElementById('tableBody').addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row) {
            const bib = parseInt(row.dataset.bib);
            if (selectedRunners.has(bib)) {
                selectedRunners.delete(bib);
                row.classList.remove('table-active');
            } else {
                selectedRunners.add(bib);
                row.classList.add('table-active');
            }
            updateChart();
            updateSelectedRunnersBadges();
        }
    });
}

// Initialize Chart
function initChart() {
    const ctx = document.getElementById('lapChart').getContext('2d');

    // Custom plugin to draw day/night background
    const dayNightPlugin = {
        id: 'dayNightBackground',
        beforeDraw: (chart) => {
            const ctx = chart.ctx;
            const chartArea = chart.chartArea;
            const xScale = chart.scales.x;

            if (!xScale || !chartArea) return;

            ctx.save();

            // Get the number of laps
            const maxLap = xScale.max || 0;

            // Draw alternating backgrounds
            for (let startLap = 1; startLap <= maxLap; startLap += 24) {
                // Trail Loop (11 hours) - Day
                const trailStart = xScale.getPixelForValue(startLap - 1);
                const trailEnd = xScale.getPixelForValue(Math.min(startLap + 10, maxLap));

                ctx.fillStyle = 'rgba(255, 223, 0, 0.1)'; // Light yellow
                ctx.fillRect(
                    trailStart,
                    chartArea.top,
                    trailEnd - trailStart,
                    chartArea.bottom - chartArea.top
                );

                // Road Loop (13 hours) - Night
                if (startLap + 11 <= maxLap) {
                    const roadStart = xScale.getPixelForValue(startLap + 10);
                    const roadEnd = xScale.getPixelForValue(Math.min(startLap + 23, maxLap));

                    ctx.fillStyle = 'rgba(0, 0, 139, 0.08)'; // Dark blue
                    ctx.fillRect(
                        roadStart,
                        chartArea.top,
                        roadEnd - roadStart,
                        chartArea.bottom - chartArea.top
                    );
                }
            }

            // Add labels for Trail and Road sections
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';

            for (let startLap = 1; startLap <= maxLap; startLap += 24) {
                // Trail label
                const trailCenter = xScale.getPixelForValue(startLap + 4.5);
                if (trailCenter && startLap + 4.5 <= maxLap) {
                    ctx.fillText('Trail', trailCenter, chartArea.top + 15);
                }

                // Road label
                if (startLap + 16.5 <= maxLap) {
                    const roadCenter = xScale.getPixelForValue(startLap + 16.5);
                    ctx.fillText('Road', roadCenter, chartArea.top + 15);
                }
            }

            ctx.restore();
        }
    };

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        plugins: [dayNightPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Lap Split Times (Trail: 11 hours, Road: 13 hours)'
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Lap Number'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Time (minutes)'
                    },
                    min: 30,
                    max: 60,
                    ticks: {
                        callback: function(value) {
                            const mins = Math.floor(value);
                            const secs = Math.round((value - mins) * 60);
                            return `${mins}:${secs.toString().padStart(2, '0')}`;
                        }
                    }
                }
            }
        }
    });
}

// Parse time string (MM:SS or HH:MM:SS) to minutes
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) + parseInt(parts[1]) / 60;
    } else if (parts.length === 3) {
        // If it's HH:MM:SS format, convert to minutes
        return parseInt(parts[0]) * 60 + parseInt(parts[1]) + parseInt(parts[2]) / 60;
    }
    return null;
}

// Calculate statistics for a runner's laps
function calculateStats(lapTimes) {
    const validTimes = lapTimes.filter(t => t !== null);
    if (validTimes.length === 0) return { mean: 0, stdDev: 0 };

    const mean = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const variance = validTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validTimes.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
}

// Calculate linear regression for trendline
function calculateTrendline(lapTimes) {
    const validPoints = [];
    lapTimes.forEach((time, index) => {
        if (time !== null) {
            validPoints.push({ x: index + 1, y: time });
        }
    });

    if (validPoints.length < 2) return null;

    const n = validPoints.length;
    const sumX = validPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = validPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = validPoints.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = validPoints.reduce((sum, point) => sum + point.x * point.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

// Update chart with selected runners
function updateChart() {
    if (!chart) return;

    const datasets = [];
    let maxLaps = 0;

    Array.from(selectedRunners).forEach((bib, index) => {
        const runner = resultsData.find(r => r.Bib === bib);
        if (!runner) return;

        // Get lap data for this runner (File number corresponds to Bib)
        const runnerLaps = lapsData.filter(lap => lap.File === bib);
        const lapTimes = runnerLaps.map(lap => parseTimeToMinutes(lap['Lap Split']));

        maxLaps = Math.max(maxLaps, lapTimes.length);

        const color = colorPalette[index % colorPalette.length];

        // Find min and max points
        const validTimes = lapTimes.filter(t => t !== null);
        const minTime = Math.min(...validTimes);
        const maxTime = Math.max(...validTimes);

        // Main line dataset
        const dataset = {
            label: runner.Name,
            data: lapTimes,
            borderColor: color,
            backgroundColor: color + '33',
            tension: 0.1,
            pointRadius: lapTimes.map(t => {
                if (t === minTime || t === maxTime) return 6;
                return 3;
            }),
            pointBackgroundColor: lapTimes.map(t => {
                if (t === minTime) return '#00FF00';
                if (t === maxTime) return '#FF0000';
                return color;
            }),
            pointBorderColor: lapTimes.map(t => {
                if (t === minTime || t === maxTime) return '#000000';
                return color;
            }),
            pointBorderWidth: lapTimes.map(t => {
                if (t === minTime || t === maxTime) return 2;
                return 1;
            })
        };

        datasets.push(dataset);

        // Add trendline for up to 3 runners
        if (selectedRunners.size <= 3) {
            const trendline = calculateTrendline(lapTimes);
            if (trendline) {
                const trendData = lapTimes.map((_, index) => {
                    const lapNumber = index + 1;
                    const trendValue = trendline.slope * lapNumber + trendline.intercept;
                    return Math.max(30, Math.min(60, trendValue)); // Clamp to chart bounds
                });

                datasets.push({
                    label: `${runner.Name} Trend`,
                    data: trendData,
                    borderColor: color + 'CC',
                    backgroundColor: 'transparent',
                    borderDash: [15, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                });
            }
        }

        // Add standard deviation bands for up to two runners
        if (selectedRunners.size <= 2) {
            const stats = calculateStats(validTimes);

            // Upper band (mean + std dev)
            datasets.push({
                label: `${runner.Name} Upper Std Dev`,
                data: lapTimes.map(t => t !== null ? Math.min(stats.mean + stats.stdDev, 60) : null),
                borderColor: color + '40',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: false
            });

            // Lower band (mean - std dev)
            datasets.push({
                label: `${runner.Name} Lower Std Dev`,
                data: lapTimes.map(t => t !== null ? Math.max(stats.mean - stats.stdDev, 30) : null),
                borderColor: color + '40',
                backgroundColor: color + '20',
                borderDash: [5, 5],
                pointRadius: 0,
                fill: '-1'
            });

        }
    });

    // Update chart
    chart.data.labels = Array.from({length: maxLaps}, (_, i) => i + 1);
    chart.data.datasets = datasets;
    chart.update();
}

// Update selected runners badges
function updateSelectedRunnersBadges() {
    const container = document.getElementById('selectedRunners');
    container.innerHTML = '';

    Array.from(selectedRunners).forEach((bib, index) => {
        const runner = resultsData.find(r => r.Bib === bib);
        if (!runner) return;

        const color = colorPalette[index % colorPalette.length];
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.backgroundColor = color;
        badge.style.color = 'white';
        badge.style.padding = '5px 10px';
        badge.innerHTML = `
            ${runner.Name} (#${runner.Bib})
            <span style="cursor: pointer; margin-left: 5px;" onclick="removeRunner(${bib})">×</span>
        `;
        container.appendChild(badge);
    });
}

// Remove runner from selection
function removeRunner(bib) {
    selectedRunners.delete(bib);
    document.querySelector(`tr[data-bib="${bib}"]`)?.classList.remove('table-active');
    updateChart();
    updateSelectedRunnersBadges();
}

// Setup resizable divider
function setupResizer() {
    const divider = document.getElementById('divider');
    const leftPanel = document.getElementById('leftPanel');
    const container = document.querySelector('.split-container');
    let isResizing = false;

    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = container.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        const percentWidth = (newWidth / containerRect.width) * 100;

        // Limit the width between 10% and 50%
        if (percentWidth >= 10 && percentWidth <= 50) {
            leftPanel.style.width = percentWidth + '%';

            // Trigger chart resize
            if (chart) {
                setTimeout(() => chart.resize(), 0);
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}
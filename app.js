/**
 * Apexflow Market Dollar Hunters - Deriv WebSocket Integration
 * Implements Tick Streaming, Proposals, Trade Execution, and Bot Hooks[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span)
 */

const CONFIG = {
    app_id: localStorage.getItem('deriv_app_id') || '1089',
    token: localStorage.getItem('deriv_token') || '',
    wsUrl: 'wss://ws.derivws.com/websockets/v3?app_id='
};

let ws = null;
let chart = null;
let activeSubscriptionId = null;
let botState = 'IDLE'; // IDLE, RUNNING, PAUSED
let tickHistoryData = [];

// Initialize Canvas Chart
function initChart() {
    const ctx = document.getElementById('marketChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: '#00ff66',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: false },
                y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Establish WebSocket Connection
function connectWebSocket() {
    ws = new WebSocket(`${CONFIG.wsUrl}${CONFIG.app_id}`);

    ws.onopen = () => {
        console.log('Deriv WebSocket Connected');
        if (CONFIG.token) {
            sendRequest({ authorize: CONFIG.token });
        }
        subscribeTicks(document.getElementById('marketSelect').value);
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
    };

    ws.onclose = () => {
        console.log('WebSocket Connection Closed. Reconnecting...');
        setTimeout(connectWebSocket, 3000);
    };
}

function sendRequest(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

// Handle Incoming API Responses
function handleIncomingMessage(data) {
    const msgType = data.msg_type;

    if (msgType === 'authorize') {
        if (data.error) {
            alert('Authentication Failed: ' + data.error.message);
        } else {
            document.getElementById('accountBalance').textContent = `$${data.authorize.balance}`;
            document.getElementById('accountID').textContent = data.authorize.loginid;
            // Subscribe to live balance updates
            sendRequest({ balance: 1, subscribe: 1 });
            // Retrieve open portfolio positions[span_11](start_span)[span_11](end_span)
            sendRequest({ portfolio: 1 });
        }
    }

    if (msgType === 'balance') {
        if (data.balance) {
            document.getElementById('accountBalance').textContent = `$${data.balance.balance}`;
        }
    }

    if (msgType === 'history') {
        const prices = data.history.prices;
        tickHistoryData = prices;
        chart.data.labels = prices.map((_, i) => i);
        chart.data.datasets[0].data = prices;
        chart.update();
    }

    if (msgType === 'tick') {
        if (data.tick) {
            const price = data.tick.quote;
            document.getElementById('livePriceDisplay').textContent = price;
            
            // Update live chart
            chart.data.labels.push(chart.data.labels.length);
            chart.data.datasets[0].data.push(price);
            if (chart.data.labels.length > 50) {
                chart.data.labels.shift();
                chart.data.datasets[0].data.shift();
            }
            chart.update();
        }
    }

    if (msgType === 'proposal') {
        if (data.proposal && !data.error) {
            // Execute buy order after proposal generated[span_12](start_span)[span_12](end_span)
            sendRequest({
                buy: data.proposal.id,
                price: data.proposal.ask_price
            });
        }
    }

    if (msgType === 'buy') {
        if (data.buy) {
            alert(`Trade Placed Successfully! Contract ID: ${data.buy.contract_id}`);
            // Subscribe to contract tracking[span_13](start_span)[span_13](end_span)
            sendRequest({ proposal_open_contract: 1, contract_id: data.buy.contract_id, subscribe: 1 });
        } else if (data.error) {
            alert(`Execution Error: ${data.error.message}`);
        }
    }
}

// Tick Subscription Management[span_14](start_span)[span_14](end_span)[span_15](start_span)[span_15](end_span)
function subscribeTicks(symbol) {
    if (activeSubscriptionId) {
        sendRequest({ forget: activeSubscriptionId });
    }
    // Fetch historical candles/ticks[span_16](start_span)[span_16](end_span)
    sendRequest({
        ticks_history: symbol,
        end: 'latest',
        count: 50,
        style: 'ticks'
    });
    // Subscribe to live tick updates[span_17](start_span)[span_17](end_span)
    sendRequest({
        ticks: symbol,
        subscribe: 1
    });
}

// Trigger Manual Order Flow
function executeManualTrade() {
    if (!CONFIG.token) {
        alert('Please connect your Deriv PAT Token first.');
        return;
    }
    const symbol = document.getElementById('marketSelect').value;
    const contractType = document.getElementById('contractType').value;
    const duration = parseInt(document.getElementById('tradeDuration').value);
    const stake = parseFloat(document.getElementById('tradeStake').value);

    // Step 1: Request Proposal[span_18](start_span)[span_18](end_span)
    sendRequest({
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type: contractType,
        currency: 'USD',
        duration: duration,
        duration_unit: 't',
        symbol: symbol
    });
}

// Bot Control Methods[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span)
function setupBotControls() {
    document.getElementById('btnAutoStart').addEventListener('click', () => {
        botState = 'RUNNING';
        document.getElementById('botStatus').textContent = 'Running';
    });
    document.getElementById('btnAutoPause').addEventListener('click', () => {
        botState = 'PAUSED';
        document.getElementById('botStatus').textContent = 'Paused';
    });
    document.getElementById('btnAutoResume').addEventListener('click', () => {
        botState = 'RUNNING';
        document.getElementById('botStatus').textContent = 'Running';
    });
    document.getElementById('btnAutoStop').addEventListener('click', () => {
        botState = 'IDLE';
        document.getElementById('botStatus').textContent = 'Idle / Stopped';
    });
}

// Event Listeners & UI Binding
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    connectWebSocket();
    setupBotControls();

    document.getElementById('marketSelect').addEventListener('change', (e) => {
        const selectedText = e.target.options[e.target.selectedIndex].text;
        document.getElementById('activeSymbolDisplay').textContent = selectedText;
        subscribeTicks(e.target.value);
    });

    document.getElementById('btnPurchase').addEventListener('click', executeManualTrade);

    // Auth Modal Handlers
    const modal = document.getElementById('authModal');
    document.getElementById('authBtn').addEventListener('click', () => modal.classList.remove('hidden'));
    document.getElementById('btnCloseAuth').addEventListener('click', () => modal.classList.add('hidden'));

    document.getElementById('btnSaveAuth').addEventListener('click', () => {
        const appId = document.getElementById('inputAppID').value;
        const token = document.getElementById('inputToken').value;

        localStorage.setItem('deriv_app_id', appId);
        localStorage.setItem('deriv_token', token);
        CONFIG.app_id = appId;
        CONFIG.token = token;

        modal.classList.add('hidden');
        connectWebSocket();
    });
});

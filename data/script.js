var wattLiveHistory = [];
//wattLiveHistory = [120, 110, 30, 50, 20, 30, 120, 110, 30, 50, 20, 30];
var wattChart1, wattChart2;

const MAX_GRAPH_LENGTH1 = 120;
const MAX_GRAPH_LENGTH2 = 60;
const SUM_PER_SEC = 60;

let wattSum = { sum: 0, count: 0 };

var latestLabel = 0;
//var intervalID = window.setInterval(myCallback, 1000);

drawChart1();
drawChart2();

if (!!window.EventSource) {
  var source = new EventSource("/events");

  source.addEventListener(
    "open",
    function (e) {
      console.log("Events Connected");
    },
    false
  );
  source.addEventListener(
    "error",
    function (e) {
      if (e.target.readyState != EventSource.OPEN) {
        console.log("Events Disconnected");
      }
    },
    false
  );

  source.addEventListener(
    "message",
    function (e) {
      console.log("message", e.data);
    },
    false
  );

  source.addEventListener(
    "watt_live",
    function (e) {
      let watts = Number(e.data);
      console.log("watt_live");

      wattLiveHistory.push(watts);
      document.getElementById("watt_live").innerHTML = watts;
      addData(watts);
      // Remove the first point so we dont just add values forever
      //removeData(wattChart);
    },
    false
  );
}

function myCallback() {
  // Your code here
  let watts = Math.random() * 10 + 50;
  console.log(watts);
  addData(watts);
}

function addData(newData) {
  console.log("adding", newData);

  wattChart1.data.datasets.forEach((dataset) => {
    if (dataset.data.length > MAX_GRAPH_LENGTH1) {
      dataset.data.shift();
    }
    dataset.data.push(newData);
  });
  wattChart1.update();
  console.log(wattSum);
  if (wattSum.count < SUM_PER_SEC) {
    wattSum.sum += newData;
    wattSum.count++;
  } else {
    addSumData(wattSum.sum / wattSum.count);
    wattSum.count = 0;
    wattSum.sum = 0;
  }
}
function addSumData(newData) {
  console.log("adding sum", newData);

  wattChart2.data.datasets.forEach((dataset) => {
    if (dataset.data.length > MAX_GRAPH_LENGTH2) {
      dataset.data.shift();
    }
    dataset.data.push(newData);
  });
  wattChart2.update();
}

function drawChart1() {
  const ctx = document.getElementById("myChart1");
  const labels = [];
  for (let i = 0; i <= MAX_GRAPH_LENGTH1; ++i) {
    labels.push(i);
  }

  wattChart1 = new Chart(ctx, {
    type: "line",

    data: {
      labels: labels,
      datasets: [
        {
          label: "WATT per second",
          pointRadius: 0,
          data: [],
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
        },
      },
    },
  });
}

function drawChart2() {
  const ctx = document.getElementById("myChart2");
  const labels = [];
  for (let i = 0; i <= MAX_GRAPH_LENGTH2; ++i) {
    labels.push(i);
  }

  wattChart2 = new Chart(ctx, {
    type: "line",

    data: {
      labels: labels,
      datasets: [
        {
          label: "avg WATT per minute",
          pointRadius: 0,
          data: [],
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
        },
      },
    },
  });
}

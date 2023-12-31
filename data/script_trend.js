const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const timeframe = urlParams.get("level");
console.log("tt", timeframe);

let local = false;
let mock = false;

// comment both below if you upload this file to the ESP
// local = true;
// mock=true;

const timeframeSpecs = {
  M: {
    unit: "M",
    url: local ? "http://192.168.2.68/get-minutes" : "/get-minutes",
    ticks: 100,
    title: "Per 5 minutes",
    difMinutesFactor: 5,
  },
  H: {
    unit: "H",
    url: local ? "http://192.168.2.68/get-hours" : "/get-hours",
    ticks: 100,
    title: "Per hour",
    difMinutesFactor: 60,
  },
  D: {
    unit: "D",
    url: local ? "http://192.168.2.68/get-days" : "/get-days",
    ticks: 100,
    title: "Per day",
    difMinutesFactor: 24 * 60,
  },
};
if (mock) {
  initMock(timeframeSpecs[timeframe]);
} else {
  init(timeframeSpecs[timeframe]);
}

function init(tfSpecs) {
  let getURL = tfSpecs.url;

  async function fetchTrend() {
    console.log("starting");
    try {
      const res = await fetch(getURL);
      const response = await res.text();
      return response;
    } catch {
      let tsdiv = document.getElementById("lastTimeStamp");
      tsdiv.innerHTML = "Could not connect.";
    }
  }
  fetchTrend().then((response) => {
    console.log(" ]]]", response);
    if (response.startsWith("<!DOCTYPE html>")) {
      let tsdiv = document.getElementById("lastTimeStamp");
      tsdiv.innerHTML = "Got no data (yet)";
    } else {
      processResponse(response, tfSpecs);
    }
  });
}
function initMock(tfSpecs) {
  response = returnMock(tfSpecs);
  processResponse(response, tfSpecs);
}
function processResponse(response, tfSpecs) {
  let graphData = calculateGraphData(response, tfSpecs);
  drawChart(
    graphData,
    "chartElec",
    "Electricity (WattHr)",
    "electricityDiff",
    tfSpecs
  );
  drawChart(graphData, "chartGas", "Gas (M3)", "gasDiff", tfSpecs);
  drawChart(graphData, "chartWater", "Water (L)", "waterDiff", tfSpecs);
}
function calculateGraphData(response, tfSpecs) {
  let titlediv = document.getElementById("title");
  titlediv.innerHTML = tfSpecs.title;
  let records = response.split(/\r?\n/);
  let dataMeasurements = [];
  let columns = [];
  let obj = {};
  records.forEach((r) => {
    columns = r.trim().split(" ");
    if (columns.length !== 6) return;
    dateString = columns[4];
    timeString = columns[5];

    if (dateString == "0") return;
    console.log(">>", dateString);
    const year = parseInt(dateString.substr(0, 2)) + 2000; // Assuming it's a year in the 21st century
    const month = parseInt(dateString.substr(2, 2)) - 1; // Months are zero-based (0-11)
    const day = parseInt(dateString.substr(4, 2));
    if (timeString === "0") timeString = "000000";
    if (timeString.length === 5) timeString = "0" + timeString;
    const hour = parseInt(timeString.substr(0, 2));
    const minute = parseInt(timeString.substr(2, 2));
    const second = parseInt(timeString.substr(4, 2));
    let date = new Date(year, month, day);
    // Create a Date object and set the time components
    date.setHours(hour);
    date.setMinutes(minute);
    date.setSeconds(second);

    obj = {
      date: date,
      electricity: parseInt(columns[0]) + parseInt(columns[1]),
      gas: parseInt(columns[2]),
      water: parseInt(columns[3]),
    };
    dataMeasurements.push(obj);
  });

  if (!dataMeasurements.length) {
    let tsdiv = document.getElementById("lastTimeStamp");
    tsdiv.innerHTML = "No data (yet)";
    return;
  }
  dataMeasurements.sort((a, b) => a.date - b.date);
  const lastTimeStamp = dataMeasurements[dataMeasurements.length - 1].date;
  let firstTimeStamp = new Date(lastTimeStamp);
  firstTimeStamp.setMinutes(
    lastTimeStamp.getMinutes() - tfSpecs.difMinutesFactor * tfSpecs.ticks
  );

  let tsdiv = document.getElementById("lastTimeStamp");
  tsdiv.innerHTML = lastTimeStamp.toLocaleString();

  let graphArray = [];
  for (let i = 0; i <= tfSpecs.ticks; i++) {
    let date = new Date(firstTimeStamp);
    date.setMinutes(date.getMinutes() + tfSpecs.difMinutesFactor * i);
    let measurement = dataMeasurements.find(
      (x) => x.date.getTime() == date.getTime()
    );
    const year = date.getFullYear() - 2000;
    const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed, so we add 1
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    // Ensure two-digit formatting for day, hours, and minutes
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

    // Construct the "dd hh:mm" format
    let formattedDateTime;
    if (tfSpecs.unit == "M") {
      formattedDateTime = `${day} ${hours}:${minutes}`;
    } else if (tfSpecs.unit == "H") {
      formattedDateTime = `${day} ${hours}:${minutes}`;
    } else {
      formattedDateTime = `${day}-${month}`;
    }
    graphArray.push({ date: date, ...measurement, xAxis: formattedDateTime });
  }
  let previousM = false;
  graphArray.forEach((currentM, i) => {
    currentM.electricityDiff = 0;
    currentM.gasDiff = 0;
    currentM.waterDiff = 0;
    if (previousM && previousM.electricity) {
      currentM.electricityDiff =
        (currentM.electricity - previousM.electricity) *
        (60 / tfSpecs.difMinutesFactor);
      currentM.gasDiff = (currentM.gas - previousM.gas) / 1000;
      currentM.waterDiff = currentM.water - previousM.water;
    }
    previousM = currentM;
  });
  return graphArray;
}

function drawChart(graphData, elementID, title, yAxisKey, tfSpecs) {
  const ctx = document.getElementById(elementID);
  const labels = [];
  new Chart(ctx, {
    type: "bar",

    data: {
      labels: labels,
      datasets: [
        {
          label: title,
          pointRadius: 0,
          data: graphData,
          borderWidth: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      parsing: {
        xAxisKey: "xAxis",
        yAxisKey: yAxisKey,
      },
      scales: {
        y: {
          beginAtZero: false,
        },
        x: {
          beginAtZero: false,
        },
      },
    },
  });
}

function returnMock(tfSpecs) {
  let responseMinute = `1499524 1962451 415473 0 230908 220000 
  1499524 1962626 415473 0 230908 220500 
  1499524 1962650 415473 0 230908 221000 
  1499524 1962661 415473 0 230908 221500 
  1499524 1962676 415473 0 230908 222000 
  1499524 1962693 415473 0 230908 222500 
  1499524 1962710 415473 0 230908 223000 
  1499524 1962727 415473 0 230908 223500 
  1499524 1962743 415473 0 230908 224000 
  1499524 1962754 415473 0 230908 224500 
  1499524 1962765 415473 0 230908 225000 
  1499524 1962770 415473 0 230908 225500 
  1499524 1962779 415473 0 230908 230000 
  1499535 1962779 415473 0 230908 230500 
  1499546 1962779 415473 0 230908 231000 
  1499557 1962779 415473 0 230908 231500 
  1499568 1962779 415473 0 230908 232000 
  1499579 1962779 415473 0 230908 232500 
  1499590 1962779 415473 0 230908 233000 
  1499600 1962779 415473 0 230908 233500 
  1499611 1962779 415473 0 230908 234000 
  1499623 1962779 415473 0 230908 234500 
  1499634 1962779 415473 0 230908 235000 
  1499646 1962779 415473 0 230908 235500 
  1499657 1962779 415473 0 230909 0 
  1496860 1949916 415309 0 230903 214500 
  1496869 1949916 415309 0 230903 215000 
  1496887 1949916 415309 0 230903 215500 
  1496904 1949916 415309 0 230903 220000 
  1496919 1949916 415309 0 230903 220500 
  1496929 1949916 415309 0 230903 221000 
  1496935 1949916 415309 0 230903 221500 
  1496941 1949916 415309 0 230903 222000 
  1496950 1949916 415309 0 230903 222500 
  1496961 1949916 415309 0 230903 223000 
  1496972 1949916 415309 0 230903 223500 
  1496978 1949916 415309 0 230903 224000 
  1496984 1949916 415309 0 230903 224500 
  1496990 1949916 415309 0 230903 225000 
  1496996 1949916 415309 0 230903 225500 
  1497058 1949916 415309 0 230903 230000 
  1499524 1960815 415309 0 230908 170900 
  1499524 1960822 415309 0 230908 171400 
  1499524 1960830 415309 0 230908 171900 
  1499524 1960838 415309 0 230908 172400 
  1499524 1960845 415309 0 230908 172900 
  1499524 1960852 415309 0 230908 173400 
  1499524 1960854 415309 0 230908 173900 
  1499524 1960855 415309 0 230908 174400 
  1499524 1960859 415309 0 230908 174900 
  1499524 1960868 415309 0 230908 175400 
  1499524 1960960 415309 0 230908 175900 
  1499524 1960994 415309 0 230908 180000 
  1499524 1961041 415332 0 230908 180500 
  1499524 1961061 415362 0 230908 181000 
  1499524 1961083 415408 0 230908 181500 
  1499524 1961105 415445 0 230908 182000 
  1499524 1961124 415473 0 230908 182500 
  1499524 1961143 415473 0 230908 183000 
  1499524 1961164 415473 0 230908 183500 
  1499524 1961189 415473 0 230908 184000 
  1499524 1961212 415473 0 230908 184500 
  1499524 1961230 415473 0 230908 185000 
  1499524 1961244 415473 0 230908 185500 
  1499524 1961257 415473 0 230908 190000 
  1499524 1961271 415473 0 230908 190500 
  1499524 1961289 415473 0 230908 191000 
  1499524 1961308 415473 0 230908 191500 
  1499524 1961327 415473 0 230908 192000 
  1499524 1961344 415473 0 230908 192500 
  1499524 1961362 415473 0 230908 193000 
  1499524 1961380 415473 0 230908 193500 
  1499524 1961403 415473 0 230908 194000 
  1499524 1961447 415473 0 230908 194500 
  1499524 1961479 415473 0 230908 195000 
  1499524 1961613 415473 0 230908 195500 
  1499524 1961795 415473 0 230908 200000 
  1499524 1961816 415473 0 230908 200500 
  1499524 1961829 415473 0 230908 201000 
  1499524 1961840 415473 0 230908 201500 
  1499524 1961851 415473 0 230908 202000 
  1499524 1961862 415473 0 230908 202500 
  1499524 1961873 415473 0 230908 203000 
  1499524 1961884 415473 0 230908 203500 
  1499524 1961895 415473 0 230908 204000 
  1499524 1961906 415473 0 230908 204500 
  1499524 1961918 415473 0 230908 205000 
  1499524 1961929 415473 0 230908 205500 
  1499524 1961943 415473 0 230908 210000 
  1499524 1961960 415473 0 230908 210500 
  1499524 1961978 415473 0 230908 211000 
  1499524 1961996 415473 0 230908 211500 
  1499524 1962013 415473 0 230908 212000 
  1499524 1962030 415473 0 230908 212500 
  1499524 1962047 415473 0 230908 213000 
  1499524 1962061 415473 0 230908 213500 
  1499524 1962074 415473 0 230908 214000 
  1499524 1962087 415473 0 230908 214500 
  1499524 1962099 415473 0 230908 215000 
  1499524 1962271 415473 0 230908 215500`;

  let responseHours = `1492603 1949916 415124 0 230902 150000 
  1492690 1949916 415124 0 230902 160000 
  1492802 1949916 415124 0 230902 170000 
  1493216 1949916 415262 0 230902 190000 
  1493387 1949916 415309 0 230902 200000 
  1493893 1949916 415309 0 230902 210000 
  1494052 1949916 415309 0 230902 220000 
  1494700 1949916 415309 0 230902 230000 
  1494807 1949916 415309 0 230903 0 
  1494924 1949916 415309 0 230903 10000 
  1495001 1949916 415309 0 230903 20000 
  1495074 1949916 415309 0 230903 30000 
  1495124 1949916 415309 0 230903 40000 
  1495192 1949916 415309 0 230903 50000 
  1495258 1949916 415309 0 230903 60000 
  1495306 1949916 415309 0 230903 70000 
  1495369 1949916 415309 0 230903 80000 
  1495428 1949916 415309 0 230903 90000 
  1495476 1949916 415309 0 230903 100000 
  1495590 1949916 415309 0 230903 110000 
  1495800 1949916 415309 0 230903 120000 
  1495901 1949916 415309 0 230903 130000 
  1496010 1949916 415309 0 230903 140000 
  1496082 1949916 415309 0 230903 150000 
  1496139 1949916 415309 0 230903 160000 
  1496214 1949916 415309 0 230903 170000 
  1496332 1949916 415309 0 230903 180000 
  1496578 1949916 415309 0 230903 190000 
  1496685 1949916 415309 0 230903 200000 
  1496806 1949916 415309 0 230903 210000 
  1496904 1949916 415309 0 230903 220000 
  1497058 1949916 415309 0 230903 230000 
  1499524 1960994 415309 0 230908 180000 
  1499524 1961257 415473 0 230908 190000 
  1499524 1961795 415473 0 230908 200000 
  1499524 1961943 415473 0 230908 210000 
  1499524 1962451 415473 0 230908 220000 
  1499524 1962779 415473 0 230908 230000 
  1499657 1962779 415473 0 230909 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0 
  0 0 0 0 0 0`;

  let responseDay = `0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
1490657 1962779 415473 0 230909 0 
1492657 1962779 416473 0 230910 0
1494657 1962779 416773 0 230911 0 
1495057 1962779 416973 0 230912 0
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
1494807 1949916 415309 0 230903 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0 
0 0 0 0 0 0`;

  let response =
    tfSpecs.unit === "M"
      ? responseMinute
      : tfSpecs.unit === "H"
      ? responseHours
      : responseDay;

  return response;
}

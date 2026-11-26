// ── STATE ──
let unitC = true, currentData = null, searchDebounce = null;

// ── CLOCK ──
function tick() {
  document.getElementById('liveClock').textContent =
    new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
setInterval(tick, 1000); tick();

// ── UNIT TOGGLE ──
document.getElementById('unitToggle').addEventListener('click', () => {
  unitC = !unitC;
  document.getElementById('unitToggle').textContent = unitC ? '°C' : '°F';
  if (currentData) renderWeather(currentData);
});

// ── HELPERS ──
function decodeWMO(code, isDay = true) {
  const map = {
    0:  [isDay ? '☀️' : '🌙', isDay ? 'Clear Sky' : 'Clear Night'],
    1:  ['🌤', 'Mainly Clear'], 2: ['⛅', 'Partly Cloudy'], 3: ['☁️', 'Overcast'],
    45: ['🌫', 'Foggy'], 48: ['🌫', 'Icy Fog'],
    51: ['🌦', 'Light Drizzle'], 53: ['🌦', 'Drizzle'], 55: ['🌧', 'Heavy Drizzle'],
    61: ['🌧', 'Slight Rain'], 63: ['🌧', 'Moderate Rain'], 65: ['🌧', 'Heavy Rain'],
    66: ['🌨', 'Freezing Rain'], 67: ['🌨', 'Heavy Freezing Rain'],
    71: ['❄️', 'Slight Snow'], 73: ['❄️', 'Moderate Snow'], 75: ['❄️', 'Heavy Snow'],
    77: ['🌨', 'Snow Grains'],
    80: ['🌦', 'Slight Showers'], 81: ['🌧', 'Moderate Showers'], 82: ['⛈', 'Violent Showers'],
    85: ['🌨', 'Snow Showers'], 86: ['🌨', 'Heavy Snow Showers'],
    95: ['⛈', 'Thunderstorm'], 96: ['⛈', 'Thunderstorm + Hail'], 99: ['⛈', 'Thunderstorm + Heavy Hail'],
  };
  return map[code] || ['🌡', 'Unknown'];
}

function windDir(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(deg / 45) % 8];
}
function fmtTemp(c) { return unitC ? Math.round(c) : Math.round(c * 9 / 5 + 32); }
function unitSuffix() { return unitC ? '°C' : '°F'; }
function fmtTime(localStr) {
  const parts = localStr.split('T');
  if (parts.length < 2) return localStr;
  const [h, m] = parts[1].split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

// ── GEOCODE ──
async function geocode(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
  return (await r.json()).results || [];
}

// ── FETCH WEATHER ──
async function fetchWeather(lat, lon, name, country, tz) {
  showLoading();
  try {
    const p = new URLSearchParams({
      latitude: lat, longitude: lon, timezone: tz || 'auto',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,visibility,dew_point_2m',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max',
      forecast_days: 7
    });
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.reason);
    currentData = { ...data, cityName: name, cityCountry: country };
    renderWeather(currentData);
  } catch (e) {
    showError(e.message || 'Could not load weather data.');
  }
}

// ── RENDER ──
function renderWeather(data) {
  const c = data.current, d = data.daily, h = data.hourly;
  const isDay = c.is_day === 1;
  const [icon, desc] = decodeWMO(c.weather_code, isDay);

  // Location
  document.getElementById('locName').textContent = data.cityName;
  document.getElementById('locCountry').textContent = data.cityCountry;

  // Temp
  document.getElementById('tempBig').textContent = fmtTemp(c.temperature_2m);
  document.getElementById('tempUnitBig').textContent = unitSuffix();
  document.getElementById('weatherDesc').textContent = desc;
  document.getElementById('feelsLike').textContent = `Feels like ${fmtTemp(c.apparent_temperature)}${unitSuffix()}`;
  document.getElementById('weatherIconBig').textContent = icon;

  // Stats
  const hum = c.relative_humidity_2m;
  document.getElementById('humidity').textContent = `${hum}%`;
  document.getElementById('humidityBar').style.width = `${hum}%`;
  const ws = c.wind_speed_10m;
  document.getElementById('windSpeed').textContent = `${ws} km/h`;
  document.getElementById('windBar').style.width = `${Math.min(ws / 120 * 100, 100)}%`;
  document.getElementById('visibility').textContent = `${c.visibility !== undefined ? (c.visibility / 1000).toFixed(1) : '—'} km`;
  document.getElementById('pressure').textContent = `${c.surface_pressure ? Math.round(c.surface_pressure) : '—'} hPa`;
  document.getElementById('dewPoint').textContent = `${fmtTemp(c.dew_point_2m)}${unitSuffix()}`;
  document.getElementById('windDir').textContent = windDir(c.wind_direction_10m);

  // Sun times
  if (d.sunrise && d.sunset) {
    document.getElementById('sunrise').textContent = fmtTime(d.sunrise[0]);
    document.getElementById('sunset').textContent = fmtTime(d.sunset[0]);
    document.querySelector('.sun-section').style.display = '';
  }

  // Alerts
  const ab = document.getElementById('alertBanner');
  if (fmtTemp(c.temperature_2m) >= (unitC ? 38 : 100)) {
    ab.classList.add('show');
    document.getElementById('alertText').textContent = 'Extreme heat warning — stay hydrated!';
  } else if (c.weather_code >= 95) {
    ab.classList.add('show');
    document.getElementById('alertText').textContent = 'Thunderstorm activity — stay indoors.';
  } else { ab.classList.remove('show'); }

  // Hourly (next 24h)
  const hourlyEl = document.getElementById('hourlyScroll');
  hourlyEl.innerHTML = '';
  const nowISO = new Date().toISOString().slice(0, 13);
  let startIdx = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i].slice(0, 13) >= nowISO) { startIdx = i; break; }
  }
  for (let i = startIdx; i < Math.min(startIdx + 24, h.time.length); i++) {
    const [hIcon] = decodeWMO(h.weather_code[i], true);
    const isNow = i === startIdx;
    const card = document.createElement('div');
    card.className = 'hour-card' + (isNow ? ' now' : '');
    card.innerHTML = `
      <div class="hour-time">${isNow ? 'Now' : fmtTime(h.time[i])}</div>
      <div class="hour-icon">${hIcon}</div>
      <div class="hour-temp">${fmtTemp(h.temperature_2m[i])}°</div>
      ${h.precipitation_probability[i] > 0 ? `<div class="hour-precip">${h.precipitation_probability[i]}%</div>` : ''}
    `;
    hourlyEl.appendChild(card);
  }

  // 7-day forecast
  const forecastEl = document.getElementById('forecastGrid');
  forecastEl.innerHTML = '';
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for (let i = 0; i < d.time.length; i++) {
    const date = new Date(d.time[i] + 'T00:00');
    const [dIcon] = decodeWMO(d.weather_code[i], true);
    const card = document.createElement('div');
    card.className = 'day-card' + (i === 0 ? ' today' : '');
    card.innerHTML = `
      <div class="day-name">${i === 0 ? 'Today' : dayNames[date.getDay()]}</div>
      <div class="day-icon">${dIcon}</div>
      <div class="day-temps">
        <span class="day-high">${fmtTemp(d.temperature_2m_max[i])}°</span>
        <span class="day-low">${fmtTemp(d.temperature_2m_min[i])}°</span>
      </div>
      ${d.precipitation_sum[i] > 0 ? `<div class="day-precip">${d.precipitation_sum[i].toFixed(1)}mm</div>` : ''}
    `;
    forecastEl.appendChild(card);
  }

  // Footer
  document.getElementById('lastUpdated').textContent = `Updated ${new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}`;

  document.getElementById('loadingMsg').classList.remove('show');
  document.getElementById('errorMsg').classList.remove('show');
  document.getElementById('weatherContent').classList.add('show');
}

// ── UI STATE ──
function showLoading() {
  document.getElementById('loadingMsg').classList.add('show');
  document.getElementById('errorMsg').classList.remove('show');
  document.getElementById('weatherContent').classList.remove('show');
}
function showError(msg) {
  document.getElementById('loadingMsg').classList.remove('show');
  const el = document.getElementById('errorMsg');
  el.innerHTML = `<p>⚠ ${msg}</p>`;
  el.classList.add('show');
}

// ── AUTOCOMPLETE & SEARCH ──
const searchInput = document.getElementById('searchInput');
const acBox = document.getElementById('autocomplete');

searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  if (q.length < 2) { acBox.classList.remove('open'); return; }
  searchDebounce = setTimeout(async () => {
    const results = await geocode(q);
    acBox.innerHTML = '';
    if (!results.length) { acBox.classList.remove('open'); return; }
    results.forEach(r => {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.textContent = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}, ${r.country}`;
      item.addEventListener('click', () => {
        searchInput.value = r.name;
        acBox.classList.remove('open');
        fetchWeather(r.latitude, r.longitude, r.name, `${r.admin1 ? r.admin1 + ', ' : ''}${r.country}`, r.timezone);
      });
      acBox.appendChild(item);
    });
    acBox.classList.add('open');
  }, 300);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) acBox.classList.remove('open');
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) { acBox.classList.remove('open'); doSearch(q); }
  }
});

async function doSearch(q) {
  const res = await geocode(q);
  if (!res.length) { showError(`No location found for "${q}".`); return; }
  const r = res[0];
  fetchWeather(r.latitude, r.longitude, r.name, `${r.admin1 ? r.admin1 + ', ' : ''}${r.country}`, r.timezone);
}

// ── GEOLOCATION ──
document.getElementById('locateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }
  showLoading();
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)).json();
      const city = j.address.city || j.address.town || j.address.village || 'Your Location';
      const state = j.address.state || '';
      const ctry = j.address.country || '';
      fetchWeather(lat, lon, city, `${state ? state + ', ' : ''}${ctry}`, 'auto');
    } catch { fetchWeather(lat, lon, 'Your Location', '', 'auto'); }
  }, () => showError('Location access denied.'));
});

// ── BOOT ──
fetchWeather(5.5502, -0.2174, 'Accra', 'Greater Accra, Ghana', 'Africa/Accra');

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { fetchRoute, login, signup } from '../api';
import { formatDistance, formatDuration, parseCoordinatePair, routePoints } from '../geo';
import type { LatLngTuple, RouteResponse } from '../types';

const DEFAULT_ORIGIN = '-29.7608,-50.0200';
const DEFAULT_DESTINATION = '-30.0346,-51.2177';
const RS_CENTER: LatLngTuple = [-29.9, -50.8];

function FitToRoute({ points }: { points: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(points, { padding: [48, 48], maxZoom: 13 });
  }, [map, points]);

  return null;
}

export function MapComponent() {
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState(DEFAULT_DESTINATION);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<null | 'create' | 'login'>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  const points = useMemo(() => (route ? routePoints(route) : []), [route]);
  const originPoint = parseCoordinatePair(origin);
  const destinationPoint = parseCoordinatePair(destination);

  function validateAuthFields(): boolean {
    if (!email.trim() || !password) {
      setAuthError('Informe usuário e senha.');
      return false;
    }
    return true;
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    if (!validateAuthFields()) return;

    setAuthLoading('create');
    try {
      await signup(email.trim(), password);
      setAuthInfo('Conta criada! Agora clique em Autenticar.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao criar conta');
    } finally {
      setAuthLoading(null);
    }
  }

  async function handleLogin() {
    setAuthError(null);
    setAuthInfo(null);
    if (!validateAuthFields()) return;

    setAuthLoading('login');
    try {
      const result = await login(email.trim(), password);
      setAuthToken(result.token);
      setAuthUid(result.uid);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao autenticar');
    } finally {
      setAuthLoading(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!parseCoordinatePair(origin) || !parseCoordinatePair(destination)) {
      setError('Use o formato lat,lng (ex.: -29.7608,-50.0200)');
      return;
    }
    if (!authToken) {
      setError('Autentique-se antes de gerar a rota.');
      return;
    }

    setLoading(true);
    try {
      const result = await fetchRoute(origin.trim(), destination.trim(), authToken);
      setRoute(result);
    } catch (err) {
      setRoute(null);
      setError(err instanceof Error ? err.message : 'Falha ao calcular a rota');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="panel">
        <p className="eyebrow">MotoTracker</p>
        <h1>Teste de rota</h1>
        <p className="lede">
          Primeiro crie a conta, depois autentique e só então gere a rota. Origem e destino em{' '}
          <code>lat,lng</code>.
        </p>

        <form className="form" onSubmit={handleCreate}>
          <label>
            Usuário (email)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rider@example.com"
              autoComplete="username"
              spellCheck={false}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={authLoading !== null}>
              {authLoading === 'create' ? 'Criando…' : 'Criar'}
            </button>
            <button type="button" className="secondary" onClick={handleLogin} disabled={authLoading !== null}>
              {authLoading === 'login' ? 'Autenticando…' : 'Autenticar'}
            </button>
          </div>
        </form>

        {authError && <p className="banner error">{authError}</p>}
        {authInfo && <p className="banner success">{authInfo}</p>}
        {authToken && (
          <p className="banner success">
            Autenticado{authUid ? ` (uid: ${authUid})` : ''}
          </p>
        )}

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Origem
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="-29.7608,-50.0200"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            Destino
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="-30.0346,-51.2177"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" disabled={loading || !authToken}>
            {loading ? 'Calculando…' : 'Gerar Rota'}
          </button>
        </form>

        {error && <p className="banner error">{error}</p>}

        {route && (
          <dl className="stats">
            <div>
              <dt>Distância</dt>
              <dd>{formatDistance(route.distance)}</dd>
              <small>{route.distance.toLocaleString('pt-BR')} m</small>
            </div>
            <div>
              <dt>Duração</dt>
              <dd>{formatDuration(route.duration)}</dd>
              <small>{route.duration.toLocaleString('pt-BR')} s</small>
            </div>
          </dl>
        )}

        <p className="hint">
          Padrão: Capão da Canoa → Porto Alegre. Crie a conta, autentique-se e depois gere a rota.
          A API precisa estar em <code>:8888</code> (o Vite faz o proxy de <code>/api</code>).
        </p>
      </aside>

      <div className="map-wrap">
        <MapContainer center={RS_CENTER} zoom={8} className="map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {originPoint && (
            <CircleMarker center={originPoint} radius={8} pathOptions={{ color: '#16a34a', fillOpacity: 1 }}>
              <Tooltip permanent direction="top" offset={[0, -8]}>
                Origem
              </Tooltip>
            </CircleMarker>
          )}

          {destinationPoint && (
            <CircleMarker
              center={destinationPoint}
              radius={8}
              pathOptions={{ color: '#dc2626', fillOpacity: 1 }}
            >
              <Tooltip permanent direction="top" offset={[0, -8]}>
                Destino
              </Tooltip>
            </CircleMarker>
          )}

          {points.length > 1 && (
            <>
              <Polyline
                positions={points}
                pathOptions={{ color: '#f59e0b', weight: 5, opacity: 0.92 }}
              />
              <FitToRoute points={points} />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

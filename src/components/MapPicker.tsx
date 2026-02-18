import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { Button } from './ui/button';

// Fix default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom coloured markers
const makeIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const greenIcon = makeIcon('green');
const redIcon = makeIcon('red');

interface Coords { lat: number; lng: number; }

interface MapPickerProps {
  onSelect: (pickup: Coords, drop: Coords) => void;
  initialPickup?: Coords;
  initialDrop?: Coords;
  /** When these change the map flies to the new location */
  focusPickup?: Coords | null;
  focusDrop?: Coords | null;
}

// ── Inner component: listens to map clicks ────────────────────────────────────
const ClickHandler = ({
  selecting,
  onPickup,
  onDrop,
}: {
  selecting: 'pickup' | 'drop';
  onPickup: (c: Coords) => void;
  onDrop: (c: Coords) => void;
}) => {
  useMapEvents({
    click(e) {
      if (selecting === 'pickup') onPickup(e.latlng);
      else onDrop(e.latlng);
    },
  });
  return null;
};

// ── Inner component: flies to a coord when it changes ────────────────────────
const FlyTo = ({ coord }: { coord: Coords | null | undefined }) => {
  const map = useMap();
  useEffect(() => {
    if (coord && coord.lat && coord.lng) {
      map.flyTo([coord.lat, coord.lng], Math.max(map.getZoom(), 14), { duration: 1 });
    }
  }, [coord?.lat, coord?.lng]);
  return null;
};

// ── Main MapPicker ────────────────────────────────────────────────────────────
const MapPicker = ({ onSelect, initialPickup, initialDrop, focusPickup, focusDrop }: MapPickerProps) => {
  const [pickup, setPickup] = useState<Coords | null>(initialPickup || null);
  const [drop, setDrop] = useState<Coords | null>(initialDrop || null);
  const [selecting, setSelecting] = useState<'pickup' | 'drop'>('pickup');

  // Sync when parent passes new coords via focusPickup / focusDrop
  useEffect(() => {
    if (focusPickup && focusPickup.lat && focusPickup.lng) {
      setPickup(focusPickup);
      setSelecting('drop'); // move to drop selection after pickup is set
    }
  }, [focusPickup?.lat, focusPickup?.lng]);

  useEffect(() => {
    if (focusDrop && focusDrop.lat && focusDrop.lng) {
      setDrop(focusDrop);
    }
  }, [focusDrop?.lat, focusDrop?.lng]);

  // Notify parent whenever both are set
  useEffect(() => {
    if (pickup && drop) onSelect(pickup, drop);
  }, [pickup, drop]);

  const handlePickup = (c: Coords) => { setPickup(c); setSelecting('drop'); };
  const handleDrop = (c: Coords) => { setDrop(c); };

  const reset = () => {
    setPickup(null);
    setDrop(null);
    setSelecting('pickup');
  };

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {pickup && drop
              ? '✓ Both locations pinned'
              : selecting === 'pickup'
                ? '📍 Tap map to set pickup'
                : '📍 Tap map to set destination'}
          </span>
          <span className="text-xs text-muted-foreground">
            Covers all of Chennai & surroundings
          </span>
        </div>
        {(pickup || drop) && (
          <Button variant="outline" size="sm" onClick={reset} className="h-7 text-xs">
            Reset
          </Button>
        )}
      </div>

      {/* Map */}
      <div className="h-[300px] w-full rounded-xl overflow-hidden border border-border relative z-0">
        <MapContainer
          center={[13.0827, 80.2707]} // Chennai Central
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickHandler selecting={selecting} onPickup={handlePickup} onDrop={handleDrop} />

          {/* Fly to searched location */}
          <FlyTo coord={focusPickup} />
          <FlyTo coord={focusDrop} />

          {pickup && <Marker position={pickup} icon={greenIcon} />}
          {drop && <Marker position={drop} icon={redIcon} />}
          {pickup && drop && (
            <Polyline
              positions={[pickup, drop]}
              color="hsl(var(--primary))"
              dashArray="6, 10"
              weight={2}
            />
          )}
        </MapContainer>
      </div>

      {/* Coordinate display */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selecting === 'pickup' ? 'border-green-500 bg-green-500/5' : 'border-border bg-card'
            }`}
          onClick={() => setSelecting('pickup')}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Pickup</span>
          </div>
          <span className="text-xs truncate block text-muted-foreground">
            {pickup ? `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}` : 'Not set'}
          </span>
        </div>
        <div
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${selecting === 'drop' ? 'border-red-500 bg-red-500/5' : 'border-border bg-card'
            }`}
          onClick={() => setSelecting('drop')}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Destination</span>
          </div>
          <span className="text-xs truncate block text-muted-foreground">
            {drop ? `${drop.lat.toFixed(4)}, ${drop.lng.toFixed(4)}` : 'Not set'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;

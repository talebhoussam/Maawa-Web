'use client';

import { useCallback, useState, memo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

// Center on Algeria
const DEFAULT_CENTER = { lat: 36.737232, lng: 3.086472 };

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0a1628' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ab4f8' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c8d7e8' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6d9eeb' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a3a5c' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d2137' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e4d80' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#05101a' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#29B6F6' }] },
  ],
};

export interface ArtisanMapPin {
  id: string;
  name: string;
  trade: string;
  lat: number;
  lng: number;
  rating: number;
  available: boolean;
}

interface Props {
  artisans: ArtisanMapPin[];
  onSelectArtisan?: (id: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

function ArtisanMap({ artisans, onSelectArtisan, center = DEFAULT_CENTER, zoom = 10 }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  const [selected, setSelected] = useState<ArtisanMapPin | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (!apiKey) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '8px',
        background: 'rgba(0,0,0,.2)', borderRadius: 'var(--rx)',
        color: 'var(--text3)', fontSize: '.78rem', textAlign: 'center', padding: '20px',
      }}>
        <div style={{ fontSize: '1.8rem' }}>🗺️</div>
        <div>Carte non disponible</div>
        <div style={{ fontSize: '.68rem', opacity: .7 }}>Ajoutez NEXT_PUBLIC_GOOGLE_MAPS_KEY dans .env.local</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rd)', fontSize: '.8rem' }}>
        Erreur chargement carte
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.15)', borderRadius: 'var(--rx)' }}>
        <div style={{ width: '28px', height: '28px', border: '3px solid var(--b500)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={MAP_CONTAINER_STYLE}
      center={center}
      zoom={zoom}
      options={MAP_OPTIONS}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={() => setSelected(null)}
    >
      {artisans.map(artisan => (
        <Marker
          key={artisan.id}
          position={{ lat: artisan.lat, lng: artisan.lng }}
          onClick={() => {
            setSelected(artisan);
            onSelectArtisan?.(artisan.id);
          }}
          icon={{
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
            fillColor: artisan.available ? '#29B6F6' : '#888',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 1.5,
            scale: 1.6,
            anchor: new window.google.maps.Point(12, 22),
          }}
        />
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.lat, lng: selected.lng }}
          onCloseClick={() => setSelected(null)}
        >
          <div style={{ fontFamily: "'Sora',sans-serif", minWidth: '160px', padding: '4px' }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#0a1628', marginBottom: '3px' }}>
              {selected.name}
            </div>
            <div style={{ fontSize: '.74rem', color: '#555', marginBottom: '5px' }}>
              {selected.trade}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.7rem', color: '#f59e0b', fontWeight: 600 }}>
                ⭐ {selected.rating}
              </span>
              <span style={{
                fontSize: '.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px',
                background: selected.available ? '#d1fae5' : '#fee2e2',
                color: selected.available ? '#065f46' : '#991b1b',
              }}>
                {selected.available ? '🟢 Dispo' : '🔴 Occupé'}
              </span>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

export default memo(ArtisanMap);

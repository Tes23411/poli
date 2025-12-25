
import React, { useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { GeoJsonFeature, Character, Demographics, Party, ElectionResults, Affiliation, StrongholdMap } from '../types';
import type { Layer, PathOptions, GeoJSON as LeafletGeoJSON, LeafletMouseEvent } from 'leaflet';
import { calculateEffectiveInfluence } from '../utils/influence';

interface MapComponentProps {
  features: GeoJsonFeature[];
  characters: Character[];
  demographicsMap: Map<string, Demographics>;
  parties: Party[];
  selectedSeatCode: string | null;
  onSeatClick: (seatCode: string | null) => void;
  affiliationToPartyMap: Map<string, string>;
  electionResults: ElectionResults;
  isPlayerMoving: boolean;
  isPositionSelectionMode?: boolean;
  onPositionSelect?: (seatCode: string) => void;
  affiliationsMap: Map<string, Affiliation>;
  strongholdMap: StrongholdMap;
}

const NEUTRAL_COLOR = '#555555';
const HIGHLIGHT_COLOR = '#FFFFFF';
const SELECTED_COLOR = '#00FFFF';
const MOVE_TARGET_COLOR = '#00FFFF';
const PLAYER_LOCATION_COLOR = '#FFD700';
const POSITION_SELECT_COLOR = '#A78BFA'; // A violet color for position selection

const MapComponent: React.FC<MapComponentProps> = ({ features, characters, demographicsMap, parties, selectedSeatCode, onSeatClick, affiliationToPartyMap, electionResults, isPlayerMoving, isPositionSelectionMode, onPositionSelect, affiliationsMap, strongholdMap }) => {
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const initialPosition: [number, number] = [4.2105, 101.9758];
  const initialZoom = 7;

  const partiesMap = useMemo(() => new Map<string, Party>(parties.map(p => [p.id, p])), [parties]);
  const featuresMap = useMemo(() => new Map(features.map(f => [f.properties.UNIQUECODE, f])), [features]);
  const player = useMemo(() => characters.find(c => c.isPlayer), [characters]);

  const seatData = useMemo(() => {
    const seatPartyMap = new Map<string, string>();
    const characterCounts = new Map<string, number>();
    const seatInfluence = new Map<string, number>();
    
    const livingCharacters = characters.filter(c => c.isAlive);
    const charactersBySeat = new Map<string, Character[]>();
    for (const char of livingCharacters) {
      if (!charactersBySeat.has(char.currentSeatCode)) {
        charactersBySeat.set(char.currentSeatCode, []);
      }
      charactersBySeat.get(char.currentSeatCode)!.push(char);
    }

    for (const [seatCode, seatCharacters] of charactersBySeat.entries()) {
      characterCounts.set(seatCode, seatCharacters.length);
      
      const seatFeature = featuresMap.get(seatCode);
      const seatDemographics = demographicsMap.get(seatCode);

      if (seatFeature) {
        const partyInfluence: { [partyId: string]: number } = {};
        let dominantPartyId = '';
        let maxInfluence = 0;
        let totalSeatInfluence = 0;
  
        for (const char of seatCharacters) {
          const partyId = affiliationToPartyMap.get(char.affiliationId);
          if (!partyId) continue;
          
          const party = partiesMap.get(partyId);
          if (!party || !party.contestedSeats.has(seatCode)) continue;
          const contestData = party.contestedSeats.get(seatCode);
          
          const effectiveInfluence = calculateEffectiveInfluence(char, seatFeature, seatDemographics || null, affiliationsMap, strongholdMap, contestData?.candidateId, contestData?.allocatedAffiliationId);
          
          partyInfluence[partyId] = (partyInfluence[partyId] || 0) + effectiveInfluence;
          totalSeatInfluence += effectiveInfluence;
        }
        
        seatInfluence.set(seatCode, totalSeatInfluence);
  
        for (const partyId in partyInfluence) {
          if (partyInfluence[partyId] > maxInfluence) {
            maxInfluence = partyInfluence[partyId];
            dominantPartyId = partyId;
          }
        }
        seatPartyMap.set(seatCode, dominantPartyId);
      }
    }

    return { seatPartyMap, characterCounts, seatInfluence };
  }, [characters, featuresMap, demographicsMap, affiliationToPartyMap, partiesMap, affiliationsMap, strongholdMap]);

  const { seatPartyMap, characterCounts, seatInfluence } = seatData;

  const highlightStyle: PathOptions = {
    weight: 2,
    color: HIGHLIGHT_COLOR,
    fillOpacity: 0.8,
  };

  const selectedStyle: PathOptions = {
    weight: 3,
    color: SELECTED_COLOR,
  };

  const getStyle = useCallback((feature?: GeoJsonFeature): PathOptions => {
    const baseStyle: PathOptions = {
      weight: 1,
      color: '#1a202c',
      fillOpacity: 0.6
    };
    
    if (!feature || !feature.properties.UNIQUECODE) {
      return { ...baseStyle, fillColor: NEUTRAL_COLOR };
    }
    
    const seatCode = feature.properties.UNIQUECODE;
    
    if (isPositionSelectionMode) {
      return {
        ...baseStyle,
        weight: 2,
        color: POSITION_SELECT_COLOR,
        fillColor: '#444',
        fillOpacity: 0.7
      };
    }
    
    if (isPlayerMoving) {
      const winningPartyId = electionResults.get(seatCode);
      const partyColor = winningPartyId ? partiesMap.get(winningPartyId)?.color : NEUTRAL_COLOR;

      if (player && seatCode === player.currentSeatCode) {
        return {
          ...baseStyle,
          weight: 3,
          color: PLAYER_LOCATION_COLOR,
          fillColor: partyColor
        };
      }
      return { 
        ...baseStyle, 
        weight: 2,
        color: MOVE_TARGET_COLOR,
        fillOpacity: 0.7,
        fillColor: partyColor
      };
    }
    
    const winningPartyId = electionResults.get(seatCode);
    let seatColor: string;

    if (winningPartyId) {
      seatColor = partiesMap.get(winningPartyId)?.color || NEUTRAL_COLOR;
    } else {
      // Fallback to live influence before first election
      const dominantPartyId = seatPartyMap.get(seatCode);
      seatColor = dominantPartyId ? (partiesMap.get(dominantPartyId)?.color || NEUTRAL_COLOR) : NEUTRAL_COLOR;
    }
    
    baseStyle.fillColor = seatColor;
    
    if (seatCode === selectedSeatCode) {
      return {
        ...baseStyle,
        ...selectedStyle,
        fillOpacity: 0.8,
      };
    }

    return baseStyle;
  }, [seatPartyMap, partiesMap, selectedSeatCode, electionResults, isPlayerMoving, player, isPositionSelectionMode]);

  const onEachFeature = useCallback((feature: GeoJsonFeature, layer: Layer) => {
    const seatCode = feature.properties?.UNIQUECODE;

    if (!seatCode || !feature.properties.PARLIMEN) return;

    if (isPositionSelectionMode) {
        const tooltipContent = `<strong>${feature.properties.PARLIMEN}</strong><br/>Click to choose as starting location.`;
        layer.bindTooltip(tooltipContent, {
            sticky: true,
            direction: 'auto',
            className: 'leaflet-tooltip-custom'
        });
    } else if (isPlayerMoving) {
      let tooltipContent = `<strong>${feature.properties.PARLIMEN}</strong><br/>Click to move here.`;
      if (player && player.currentSeatCode === seatCode) {
          tooltipContent = `<strong>${feature.properties.PARLIMEN}</strong><br/>(Current Location)<br/>Click again to cancel move.`;
      }
      layer.bindTooltip(tooltipContent, {
          sticky: true,
          direction: 'auto',
          className: 'leaflet-tooltip-custom'
      });
    } else {
      const livingCharactersInSeat = characters.filter(c => c.isAlive && c.currentSeatCode === seatCode);
      const count = livingCharactersInSeat.length;
      const influence = seatInfluence.get(seatCode) || 0;
      const demoData = demographicsMap.get(seatCode);
      
      const dominantPartyId = seatData.seatPartyMap.get(seatCode);
      const dominantParty = dominantPartyId ? partiesMap.get(dominantPartyId) : null;

      const winningPartyId = electionResults.get(seatCode);
      const ownerParty = winningPartyId ? partiesMap.get(winningPartyId) : null;

      let demographicInfo = '';
      if (demoData) {
        demographicInfo = `
          <br /><hr style="margin: 4px 0; border-color: #444;" />
          Electorate: ${demoData.totalElectorate.toLocaleString()}
          <br />
          Malay: ${demoData.malayPercent}%
          <br />
          Chinese: ${demoData.chinesePercent}%
          <br />
          Indian: ${demoData.indianPercent}%
        `;
      }
      
      const ownerInfo = ownerParty
        ? `<br />Seat Held By: ${ownerParty.name}`
        : '';
      
      const dominantInfo = dominantParty 
        ? `<br />Current Influence: ${dominantParty.name}` 
        : '<br />Current Influence: Neutral';

      const tooltipContent = `
        <div>
          <strong>${feature.properties.PARLIMEN}</strong>
          ${ownerInfo}
          ${dominantInfo}
          <br />
          Characters: ${count.toLocaleString()}
          ${demographicInfo}
        </div>
      `;
      layer.bindTooltip(tooltipContent, {
        sticky: true,
        direction: 'auto',
        className: 'leaflet-tooltip-custom'
      });
    }

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        if (!isPlayerMoving && !isPositionSelectionMode && feature.properties.UNIQUECODE !== selectedSeatCode) {
            e.target.setStyle(highlightStyle);
        }
        e.target.bringToFront();
      },
      mouseout: (e: LeafletMouseEvent) => {
         if (geoJsonRef.current) {
            if (!isPlayerMoving && !isPositionSelectionMode && feature.properties.UNIQUECODE !== selectedSeatCode) {
                geoJsonRef.current.resetStyle(e.target);
            }
         }
      },
      click: () => {
        if (isPositionSelectionMode) {
          onPositionSelect?.(seatCode);
        } else {
          onSeatClick(seatCode);
        }
      }
    });
  }, [characterCounts, demographicsMap, seatData, partiesMap, selectedSeatCode, onSeatClick, electionResults, characters, isPlayerMoving, player, isPositionSelectionMode, onPositionSelect]);
  
  const geoJsonKey = useMemo(() => {
    const charSummary = characters.map(c => `${c.id}@${c.currentSeatCode}-${c.affiliationId}-${c.isAlive}`).join(',');
    const resultsSummary = Array.from(electionResults.entries()).map(([k,v]) => `${k}:${v}`).join(',');
    const partyContestSummary = parties.map(p => `${p.id}:${Array.from(p.contestedSeats.keys()).join('-')}`).join(',');
    return `${charSummary}-${selectedSeatCode}-${resultsSummary}-${isPlayerMoving}-${isPositionSelectionMode}-${partyContestSummary}`;
  }, [characters, selectedSeatCode, electionResults, isPlayerMoving, parties, isPositionSelectionMode]);

  return (
    <div className="h-full w-full absolute top-0 left-0 z-0">
      <MapContainer 
        center={initialPosition} 
        zoom={initialZoom} 
        scrollWheelZoom={true} 
        className="h-full w-full"
        minZoom={2}
        worldCopyJump={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />
        <GeoJSON 
          key={geoJsonKey}
          ref={geoJsonRef}
          data={features as any} 
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
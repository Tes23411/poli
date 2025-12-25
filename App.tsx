
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Character, Party, GameState, Speed, GeoJsonFeature, Demographics, 
  Affiliation, ElectionResults, ElectionHistoryEntry, SeatWinner, 
  PlaySpeedValue, ActionType, CharacterRole, Bill, BillVoteTally, 
  BillVoteBreakdown, VoteDirection, PartyElectionVoteTally, Ethnicity,
  SpeakerVoteTally, SpeakerVoteBreakdown, PartyManagementScreenProps,
  Government, VoteOfConfidenceResult, PoliticalAlliance, AllianceType, SeatCandidateInfo,
  UnificationMode, Ideology, GameEvent, ElectionSystem, LogEntry, StrongholdMap
} from './types';
import { AFFILIATIONS, PARTIES, INITIAL_ALLIANCES } from './affiliations';
import { malaysiaSeatsData } from './data/kelantan';
import { loadDemographicsData } from './data/demographics';
import { determineAIAction } from './utils/ai';
import { calculateEffectiveInfluence } from './utils/influence';
import { 
  conductPartyLeadershipElection, 
  electStateLeadersAndExecutives, 
  aiFullElectionStrategy, 
  determineSpeakerCandidates,
  conductSpeakerVote,
  handleAffiliationSecession,
  handlePartyMerger,
  handlePartyAbsorption,
  attemptAllianceFormation,
  updateAffiliationLeaders,
  aiDecideBillVote,
  formGovernment,
  conductVoteOfConfidence,
  initializePartyRelations,
  distributeAllianceSeats,
  updateAffiliationIdeologies,
  updatePartyIdeologies,
  getPartySeatCounts,
  performSecurityCrackdown,
  formBigTentCoalition,
  consolidateAllianceCohesion,
  attemptAllianceMerger,
  handleCharacterIdeologicalDrift,
  cleanupPoliticalVacancies,
  cleanupGovernmentVacancies
} from './utils/politics';
import { generateBill } from './utils/legislation';
import { generateCharacterName, generatePartyName, generateAllianceName } from './utils/naming';
import { COLOR_PALETTE } from './constants';
import { checkForGameEvent, applyEventEffects } from './utils/events';
import { shouldCharacterDie, createSuccessor } from './utils/simulation';

// Screens
import StartScreen from './screens/StartScreen';
import PartySelectionScreen from './screens/PartySelectionScreen';
import CharacterSelectionScreen from './screens/CharacterSelectionScreen';
import PartyManagementScreen from './screens/PartyManagementScreen';
import CharacterActionScreen from './screens/CharacterActionScreen';
import AffiliationManagementScreen from './screens/AffiliationManagementScreen';
import PartyElectionScreen from './screens/PartyElectionScreen';
import ElectionHistoryScreen from './screens/ElectionHistoryScreen';
import ParliamentScreen from './screens/ParliamentScreen';
import SpeakerElectionScreen from './screens/SpeakerElectionScreen';
import SecessionJoinPartyScreen from './screens/SecessionJoinPartyScreen';
import SecessionNewPartyScreen from './screens/SecessionNewPartyScreen';
import PartyMergerScreen from './screens/PartyMergerScreen';
import AllianceCreationScreen from './screens/AllianceCreationScreen';
import GovernmentFormationScreen from './screens/GovernmentFormationScreen';
import BillSelectionScreen from './screens/BillSelectionScreen';

// Components
import MapComponent from './components/MapComponent';
import GameControlPanel from './components/GameControlPanel';
import { ConstituencyPanel } from './components/ConstituencyPanel';
import CharacterInfoPanel from './components/CharacterInfoPanel';
import PartyPanel from './components/PartyPanel';
import PlayerCharacterButton from './components/PlayerCharacterButton';
import PartyElectionResultsPanel from './components/PartyElectionResultsPanel';
import ElectionResultsPanel from './components/ElectionResultsPanel';
import SpeakerElectionResultsPanel from './components/SpeakerElectionResultsPanel';
import MergerResultModal from './components/MergerResultModal';
import PartyListPanel from './components/PartyListPanel';
import EventModal from './components/EventModal';
import BillProposalPanel from './components/BillProposalPanel';
import BillResultsPanel from './components/BillResultsPanel';
import EventLogPanel from './components/EventLogPanel';
import CountryInfoPanel from './components/CountryInfoPanel';

const START_DATE = new Date('1951-01-01');
const ELECTION_INTERVAL_MS = 4 * 365 * 24 * 60 * 60 * 1000; // 4 years approx

// Custom hook for stable intervals
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentDate, setCurrentDate] = useState<Date>(START_DATE);
  const [playSpeed, setPlaySpeed] = useState<Speed>(null);
  const [parties, setParties] = useState<Party[]>(PARTIES);
  const [alliances, setAlliances] = useState<PoliticalAlliance[]>(INITIAL_ALLIANCES);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [playerCharacterId, setPlayerCharacterId] = useState<string | null>(null);
  // Pending character state for position selection flow
  const [pendingCharacter, setPendingCharacter] = useState<Omit<Character, 'currentSeatCode'> | null>(null);
  
  const [features, setFeatures] = useState<GeoJsonFeature[]>(malaysiaSeatsData);
  const [demographicsMap, setDemographicsMap] = useState<Map<string, Demographics>>(new Map());
  // Affiliations are static config, but ideology is dynamic
  const [affiliationsMap, setAffiliationsMap] = useState<Map<string, Affiliation>>(new Map(AFFILIATIONS.map(a => [a.id, a])));
  
  const [selectedSeatCode, setSelectedSeatCode] = useState<string | null>(null);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [viewingPartyId, setViewingPartyId] = useState<string | null>(null);

  const [electionResults, setElectionResults] = useState<ElectionResults>(new Map());
  const [detailedElectionResults, setDetailedElectionResults] = useState<Map<string, Map<string, number>>>(new Map());
  const [electionHistory, setElectionHistory] = useState<ElectionHistoryEntry[]>([]);
  const [electionSystem, setElectionSystem] = useState<ElectionSystem>('FPTP');
  const [strongholdMap, setStrongholdMap] = useState<StrongholdMap>(new Map());
  
  // UI State
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const [showParliament, setShowParliament] = useState(false);
  const [showElectionHistory, setShowElectionHistory] = useState(false);
  const [showPartyList, setShowPartyList] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showCountryInfo, setShowCountryInfo] = useState(false);
  
  // Interaction State for complex flows
  const [partyManagementOpen, setPartyManagementOpen] = useState(false);
  const [actionScreenOpen, setActionScreenOpen] = useState(false);
  const [affiliationManagementData, setAffiliationManagementData] = useState<{
      affiliationId: string;
      allocatedSeats: { seatCode: string; party: Party; seatFeature: GeoJsonFeature }[];
  } | null>(null);
  
  // Elections & Politics State
  // 1953 for first party election
  const [nextPartyElectionDate, setNextPartyElectionDate] = useState<Date>(new Date('1953-06-15'));

  const [partyElectionData, setPartyElectionData] = useState<{
      party: Party;
      candidates: Character[];
      voteTally?: PartyElectionVoteTally;
      winnerId?: string;
      deputyWinnerId?: string;
  } | null>(null);

  const [speakerElectionData, setSpeakerElectionData] = useState<{
      candidates: Character[];
      results?: { winner: Character; tally: SpeakerVoteTally; breakdown: SpeakerVoteBreakdown };
  } | null>(null);
  
  const [government, setGovernment] = useState<Government | null>(null);

  // Regime Tracking
  const [regimeStartDate, setRegimeStartDate] = useState<Date>(START_DATE);
  const [regimeLeaderPartyId, setRegimeLeaderPartyId] = useState<string | null>('umno'); // Default to initial leading party if relevant
  const [bigTentTriggered, setBigTentTriggered] = useState<boolean>(false);

  const [parliamentBill, setParliamentBill] = useState<Bill | null>(null);
  const [billVoteResults, setBillVoteResults] = useState<{ passed: boolean; tally: BillVoteTally; breakdown: BillVoteBreakdown; } | null>(null);
  
  const [secessionData, setSecessionData] = useState<{
      affiliationId: string;
      leaderId: string;
      type: 'join' | 'new';
  } | null>(null);

  const [mergerData, setMergerData] = useState<{
      initiatingPartyId: string;
      results?: { accepted: (Party | Affiliation)[]; rejected: (Party | Affiliation)[]; newName: string; };
  } | null>(null);
  
  // New state to track which mode we are in
  const [mergerMode, setMergerMode] = useState<UnificationMode>('merge');

  // State to track if we've run the post-election AI strategy for the current cycle
  const [hasRunPostElectionStrategy, setHasRunPostElectionStrategy] = useState(false);
  
  // State to track player actions per election cycle
  const [hasPlayerManagedStrategy, setHasPlayerManagedStrategy] = useState(false);
  const [hasPlayerManagedAffiliation, setHasPlayerManagedAffiliation] = useState(false);

  // New Event State
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [preEventSpeed, setPreEventSpeed] = useState<Speed>(null);

  // Observe Mode State
  const [observeMode, setObserveMode] = useState<boolean>(false);
  const [gameLog, setGameLog] = useState<LogEntry[]>([]);
  const [unreadLogCount, setUnreadLogCount] = useState(0);

  // --- Computed Memos ---
  const featuresMap = useMemo(() => new Map(features.map(f => [f.properties.UNIQUECODE, f])), [features]);
  const partiesMap = useMemo(() => new Map(parties.map(p => [p.id, p])), [parties]);
  const affiliationToPartyMap = useMemo(() => {
    const map = new Map<string, string>();
    parties.forEach(p => p.affiliationIds.forEach(affId => map.set(affId, p.id)));
    return map;
  }, [parties]);
  
  const playerCharacter = useMemo(() => characters.find(c => c.id === playerCharacterId) || null, [characters, playerCharacterId]);
  const uniqueStates = useMemo(() => Array.from(new Set(features.map(f => f.properties.NEGERI))).filter(Boolean) as string[], [features]);
  const allSeatCodes = useMemo(() => features.map(f => f.properties.UNIQUECODE).filter(Boolean), [features]);

  const selectedSeat = useMemo(() => selectedSeatCode ? featuresMap.get(selectedSeatCode) : undefined, [selectedSeatCode, featuresMap]);
  const selectedSeatDemographics = useMemo(() => selectedSeatCode ? demographicsMap.get(selectedSeatCode) || null : null, [selectedSeatCode, demographicsMap]);
  const selectedParty = useMemo(() => selectedPartyId ? partiesMap.get(selectedPartyId) : undefined, [selectedPartyId, partiesMap]);
  
  const playerParty = useMemo(() => playerCharacter ? partiesMap.get(affiliationToPartyMap.get(playerCharacter.affiliationId) || '') : null, [playerCharacter, partiesMap, affiliationToPartyMap]);
  const speaker = useMemo(() => characters.find(c => c.isMP && c.currentSeatCode === 'SPEAKER') || null, [characters]); 

  const nextElectionDate = useMemo(() => {
      if (electionHistory.length === 0) {
          // First General Election is in 1955
          return new Date('1955-07-27');
      }
      const lastElection = electionHistory[electionHistory.length - 1].date;
      return new Date(lastElection.getTime() + ELECTION_INTERVAL_MS);
  }, [electionHistory]);

  const daysUntilElection = useMemo(() => {
      return Math.ceil((nextElectionDate.getTime() - currentDate.getTime()) / (1000 * 60 * 72 * 24));
  }, [nextElectionDate, currentDate]);

  const playerRoleInfo = useMemo(() => {
      if (!playerCharacter || !playerParty) return { role: 'Member' as CharacterRole, details: 'Member' };
      
      if (government && government.chiefMinisterId === playerCharacter.id) return { role: 'Chief Minister' as CharacterRole, details: 'Chief Minister' };
      
      const cabinetPos = government?.cabinet.find(m => m.ministerId === playerCharacter.id);
      if (cabinetPos) return { role: 'Minister' as CharacterRole, details: `Minister of ${cabinetPos.portfolio}` };

      if (playerParty.leaderId === playerCharacter.id) return { role: 'National Leader' as CharacterRole, details: 'National Leader' };
      if (playerParty.deputyLeaderId === playerCharacter.id) return { role: 'National Deputy Leader' as CharacterRole, details: 'National Deputy Leader' };
      
      const stateBranch = playerParty.stateBranches.find(b => b.state === playerCharacter.state);
      if (stateBranch?.leaderId === playerCharacter.id) return { role: 'State Leader' as CharacterRole, details: `State Leader (${playerCharacter.state})` };
      if (stateBranch?.executiveIds.includes(playerCharacter.id)) return { role: 'State Executive' as CharacterRole, details: `State Executive (${playerCharacter.state})` };

      return { role: 'Member' as CharacterRole, details: 'Ordinary Member' };
  }, [playerCharacter, playerParty, government]);

  const isElectionClose = daysUntilElection <= 20;

  // --- Effects ---

  useEffect(() => {
    const loadData = async () => {
      const demoData = await loadDemographicsData();
      const dMap = new Map<string, Demographics>();
      demoData.forEach(d => dMap.set(d.uniqueCode, d));
      setDemographicsMap(dMap);
    };
    loadData();
  }, []);
  
  // Clear unread count when log is opened
  useEffect(() => {
      if (showEventLog) {
          setUnreadLogCount(0);
      }
  }, [showEventLog]);

  const addToLog = useCallback((title: string, description: string, type: 'event' | 'politics' | 'election' | 'personal') => {
      setGameLog(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random()}`,
          date: currentDate, // Uses current date at time of adding
          title,
          description,
          type
      }]);
      if (!showEventLog) {
          setUnreadLogCount(prev => prev + 1);
      }
  }, [currentDate, showEventLog]);

  // --- Game Loop ---
  useInterval(() => {
    if (gameState !== 'game') return;

    // Enforce speed restriction close to election
    const daysUntil = Math.ceil((nextElectionDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 20 && playSpeed !== null && playSpeed < 125) {
        setPlaySpeed(125);
    }

    setCurrentDate(prevDate => {
      const nextDate = new Date(prevDate);
      nextDate.setDate(prevDate.getDate() + 1);
      
      // Periodic Checks
      // 1. General Elections
      if (nextElectionDate && nextDate >= nextElectionDate) {
         setPlaySpeed(null);
         // Defer execution to avoid state update conflicts in loop
         setTimeout(() => {
             handleGeneralElection(nextDate);
             setHasRunPostElectionStrategy(false);
         }, 0);
      }
      
      // 2. Population Growth & Mortality (Monthly on the 1st)
      if (nextDate.getDate() === 1) {
          setTimeout(() => {
              // Growth
              setDemographicsMap(prevMap => {
                  const newMap = new Map(prevMap);
                  newMap.forEach((demo, code) => {
                      const classification = demo['urbanRuralClassification'];
                      const isUrban = typeof classification === 'string' && classification.toUpperCase() === 'URBAN';
                      
                      // Monthly growth rates: Urban ~0.25% (3% annual), Rural ~0.125% (1.5% annual)
                      const growthRate = isUrban ? 0.004 : 0.002; 
                      const growth = Math.ceil(demo.totalElectorate * growthRate);
                      
                      newMap.set(code, {
                          ...demo,
                          totalElectorate: demo.totalElectorate + growth
                      });
                  });
                  return newMap;
              });

          }, 0);
      }
      
      // Daily Mortality Check
      if (Math.random() < 0.25) { 
           setTimeout(() => {
                let deaths: string[] = [];
                let replacements: Character[] = [];
                
                setCharacters(prevChars => {
                    const nextChars = prevChars.map(c => {
                        if (c.isAlive && !c.isPlayer && shouldCharacterDie(c, nextDate)) {
                            deaths.push(c.name);
                            const successor = createSuccessor(c, nextDate);
                            replacements.push(successor);
                            return { 
                                ...c, 
                                isAlive: false, 
                                history: [...c.history, { date: nextDate, event: "Died of natural causes." }] 
                            };
                        }
                        return c;
                    });
                    
                    if (deaths.length > 0) {
                         const livingIds = new Set(nextChars.filter(c => c.isAlive).map(c => c.id));
                         // Queue side effects
                         setTimeout(() => {
                            deaths.forEach(name => addToLog('Obituary', `${name} has passed away.`, 'personal'));
                            replacements.forEach(r => {
                                const seatName = featuresMap.get(r.currentSeatCode)?.properties.PARLIMEN || r.currentSeatCode;
                                const affName = affiliationsMap.get(r.affiliationId)?.name || 'Unknown Faction';
                                addToLog('New Blood', `${r.name} has emerged to represent the ${affName} in ${seatName}.`, 'politics');
                            });
                             setParties(prev => cleanupPoliticalVacancies(prev, livingIds, nextDate));
                             setGovernment(prev => cleanupGovernmentVacancies(prev, livingIds));
                         }, 0);
                    }
                    
                    return [...nextChars, ...replacements];
                });

           }, 0);
      }

// 3. Party Elections (First in 1953)
      if (nextDate >= nextPartyElectionDate) {
          setPlaySpeed(null);
          setTimeout(() => {
              // Auto-resolve all NON-player party elections first
              parties.forEach(p => {
                  if (!playerParty || p.id !== playerParty.id) {
                      handlePartyElectionAuto(p, nextDate);
                  }
              });
              
              // Schedule next party election BEFORE triggering player election
              setNextPartyElectionDate(new Date(nextDate.getFullYear() + 3, nextDate.getMonth(), nextDate.getDate()));
              
              // Only trigger explicit voting screen if player is involved
              if (playerParty) {
                  handlePartyElectionStart(playerParty);
              } else {
                  // Resume speed if spectator
                  setPlaySpeed(playSpeed);
              }
          }, 0);
      }
      
      // 4. State Party Elections (Same year as National Party Election in May)
      if (nextDate.getMonth() === 4 && nextDate.getDate() === 1 && nextDate.getFullYear() === nextPartyElectionDate.getFullYear()) {
          setTimeout(() => handleStatePartyElections(nextDate), 0);
      }
      
      // 5. Political Developments (Formation / Struggle / Alliances) - Monthly
      if (nextDate.getDate() === 15) {
          setTimeout(() => handlePoliticalDevelopments(nextDate), 0);
          
          // Alliance Consolidation (Monthly)
          setTimeout(() => {
              setParties(prevParties => consolidateAllianceCohesion(prevParties, alliances));
          }, 0);

          // NEW: Ideological Drift
           setTimeout(() => {
              setCharacters(prevChars => {
                  const { updatedCharacters, driftLogs } = handleCharacterIdeologicalDrift(prevChars, affiliationsMap, nextDate);
                  if (driftLogs.length > 0) {
                       driftLogs.forEach(log => addToLog('Faction Drift', log, 'politics'));
                  }
                  return updatedCharacters;
              });
          }, 0);
      }
      
      // 20-Year Regime Check (Annual check on Jan 1st is sufficient)
      if (nextDate.getMonth() === 0 && nextDate.getDate() === 1) {
          const yearsRuled = (nextDate.getFullYear() - regimeStartDate.getFullYear());
          if (yearsRuled > 20 && !bigTentTriggered && government) {
              const result = formBigTentCoalition(parties, government.rulingCoalitionIds, null); // AI creates it
              if (result) {
                  // Fix: Ensure we don't create dual alliances
                  setAlliances(prev => {
                      const newMemberIds = result.alliance.memberPartyIds;
                      // Filter out these members from existing alliances
                      const cleanedAlliances = prev.map(a => ({
                          ...a,
                          memberPartyIds: a.memberPartyIds.filter(pid => !newMemberIds.includes(pid))
                      })).filter(a => a.memberPartyIds.length >= 2); // Remove broken alliances
                      
                      return [...cleanedAlliances, result.alliance];
                  });

                   setParties(result.parties);
                   setBigTentTriggered(true);
                   
                   const event: GameEvent = {
                       id: `evt-bigtent-${Date.now()}`,
                       title: "End of an Era?",
                       description: `The current regime has held power for over 20 years. In a historic move, opposition parties have united to form "${result.alliance.name}" to challenge the incumbent's dominance.`,
                       date: nextDate,
                       type: 'political',
                       effects: [
                           "Opposition parties form a single bloc.",
                           "Opposition unity greatly increased.",
                           "Increased political polarization."
                       ]
                   };
                   
                   if (observeMode) {
                        addToLog(event.title, event.description, 'event');
                   } else {
                       setCurrentEvent(event);
                       setPreEventSpeed(playSpeed);
                       setPlaySpeed(null);
                       setGameState('event-modal');
                   }
              }
          }
      }

      // 6. Game Events (Monthly Check)
      if (nextDate.getDate() === 1 || nextDate.getDate() === 15) {
           setTimeout(() => {
               const event = checkForGameEvent(nextDate, characters, parties, demographicsMap, features, affiliationsMap);
               if (event) {
                   if (observeMode) {
                        const { updatedCharacters, updatedParties } = applyEventEffects(event, characters, parties, affiliationsMap);
                        setCharacters(updatedCharacters);
                        setParties(updatedParties);
                        addToLog(event.title, event.description, 'event');
                   } else {
                       setCurrentEvent(event);
                       setPreEventSpeed(playSpeed); // Capture current speed
                       setPlaySpeed(null); // Pause
                       setGameState('event-modal');
                   }
               }
           }, 0);
      }

      return nextDate;
    });
    
    // Check for Post-Election/Initial AI Strategy Trigger
    const lastEventDate = electionHistory.length > 0 ? electionHistory[electionHistory.length - 1].date : START_DATE;
    const daysSinceLastEvent = Math.floor((currentDate.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastEvent === 21 && !hasRunPostElectionStrategy) {
        runAIStrategies();
        setHasRunPostElectionStrategy(true);
    }
    
    // Periodically refresh affiliation leaders (e.g., every 30 days)
    // Also recalculate ideologies based on member shifts
    if (currentDate.getDate() === 1) {
         setCharacters(prevChars => {
             const newChars = updateAffiliationLeaders(prevChars, affiliationsMap ? Array.from(affiliationsMap.values()) : AFFILIATIONS);
             // Update affiliationsMap with new average ideologies
             const updatedAffiliations = updateAffiliationIdeologies(newChars, AFFILIATIONS);
             setAffiliationsMap(new Map(updatedAffiliations.map(a => [a.id, a])));
             
             // Update parties with new average ideologies
             setParties(prevParties => updatePartyIdeologies(prevParties, updatedAffiliations));

             return newChars;
         });
    }

    // Calculate Seat Population by Affiliation for AI movement constraint
    const seatAffiliationPopMap = new Map<string, Map<string, number>>();
    const seatTotalPopMap = new Map<string, number>();

    characters.forEach(c => {
        if (c.isAlive) {
            if (!seatAffiliationPopMap.has(c.currentSeatCode)) {
                seatAffiliationPopMap.set(c.currentSeatCode, new Map());
            }
            const affMap = seatAffiliationPopMap.get(c.currentSeatCode)!;
            affMap.set(c.affiliationId, (affMap.get(c.affiliationId) || 0) + 1);

            seatTotalPopMap.set(c.currentSeatCode, (seatTotalPopMap.get(c.currentSeatCode) || 0) + 1);
        }
    });

    // AI Processing
    setCharacters(prevChars => prevChars.map(char => {
         if (char.isPlayer || !char.isAlive) return char;
         
         const partyId = affiliationToPartyMap.get(char.affiliationId);
         const party = partyId ? partiesMap.get(partyId) : undefined;
         
         let role: CharacterRole = 'Member';
         if (party) {
             if (party.leaderId === char.id) role = 'National Leader';
             else if (party.deputyLeaderId === char.id) role = 'National Deputy Leader';
             else {
                 const branch = party.stateBranches.find(b => b.state === char.state);
                 if (branch?.leaderId === char.id) role = 'State Leader';
                 else if (branch?.executiveIds.includes(char.id)) role = 'State Executive';
             }
         }

         return determineAIAction(char, role, prevChars, allSeatCodes, featuresMap, demographicsMap, affiliationToPartyMap, affiliationsMap, seatAffiliationPopMap, seatTotalPopMap, strongholdMap);
    }));

  }, playSpeed);

  // --- Handlers ---
  
  const handleEventAcknowledge = () => {
      if (currentEvent) {
          const { updatedCharacters, updatedParties } = applyEventEffects(currentEvent, characters, parties, affiliationsMap);
          setCharacters(updatedCharacters);
          setParties(updatedParties);
          addToLog(currentEvent.title, currentEvent.description, 'event');
      }
      setCurrentEvent(null);
      setGameState('game');
      setPlaySpeed(preEventSpeed); // Restore to previous speed
  };

  const handlePoliticalDevelopments = (date: Date) => {
      let activeParties = [...parties];
      let activeCharacters = [...characters];
      let activeElectionResults = new Map(electionResults);
      let activeAlliances = [...alliances];
      
      const getAffiliationToPartyMap = () => {
          const map = new Map<string, string>();
          activeParties.forEach(p => p.affiliationIds.forEach(id => map.set(id, p.id)));
          return map;
      };
// Add this helper function near the top of handlePoliticalDevelopments
const canAffiliationJoinParty = (affiliation: Affiliation, party: Party): boolean => {
    // Multi-ethnic parties accept anyone
    if (!party.ethnicityFocus) return true;
    
    // Same ethnicity is always OK
    if (party.ethnicityFocus === affiliation.ethnicity) return true;
    
    // Ethnicity-focused party cannot accept different ethnicity
    return false;
};
      // PHASE 1: Alliance Integrity & Disbandment
      const alliancesToDissolve = new Set<string>();
      
      activeAlliances.forEach(alliance => {
          const leaderParty = activeParties.find(p => p.id === alliance.leaderPartyId);
          if (!leaderParty) {
              alliancesToDissolve.add(alliance.id);
              return;
          }

          // Filter members who stay
          const newMemberIds = alliance.memberPartyIds.filter(memberId => {
              if (memberId === alliance.leaderPartyId) return true;
              const memberParty = activeParties.find(p => p.id === memberId);
              if (!memberParty) return false;

              // Check Relations
              const relation = leaderParty.relations.get(memberId) || 50;
              // Check Ideology Distance
              const dist = Math.sqrt(Math.pow(leaderParty.ideology.economic - memberParty.ideology.economic, 2) + Math.pow(leaderParty.ideology.governance - memberParty.ideology.governance, 2));
              
              // Leave if relation is very poor OR ideology is too divergent
              if (relation < 40 || dist > 40) {
                  addToLog('Alliance Breakup', `${memberParty.name} has withdrawn from the ${alliance.name} due to disagreements.`, 'politics');
                  return false;
              }
              return true;
          });

          alliance.memberPartyIds = newMemberIds;
          
          if (alliance.memberPartyIds.length < 2) {
              alliancesToDissolve.add(alliance.id);
              addToLog('Alliance Collapse', `The ${alliance.name} has collapsed due to lack of members.`, 'politics');
          }
      });

      if (alliancesToDissolve.size > 0) {
          activeAlliances = activeAlliances.filter(a => !alliancesToDissolve.has(a.id));
      }


      // PHASE 2: Party Schisms (Multiple Affiliations Splitting)
      // Step 1: Update Unity for all parties
      activeParties = activeParties.map(p => {
          let newUnity = p.unity;
          if (p.affiliationIds.length > 1) {
             newUnity += (Math.random() * 4 - 2.5); 
          } else {
             newUnity += (Math.random() * 2 - 0.5);
          }
          return { ...p, unity: Math.max(0, Math.min(100, newUnity)) };
      });

      // Step 2: Check for Schisms
      let schismOccurred = false;
      const partyIdsToCheck = activeParties.map(p => p.id);

      for (const pId of partyIdsToCheck) {
          if (schismOccurred) break;
          
          let p = activeParties.find(party => party.id === pId);
          if (!p) continue;

          // Reduced probability and stricter unity check for Schism
          if (p.unity < 20 && p.affiliationIds.length >= 3) {
               if (Math.random() < 0.05) {
                   const partyMembers = activeCharacters.filter(c => p!.affiliationIds.includes(c.affiliationId) && c.isAlive);
                   const nonLeaderInfluentials = partyMembers.filter(c => c.isAffiliationLeader && c.id !== p!.leaderId);
                   
                   if (nonLeaderInfluentials.length === 0) continue;

                   const dissidentLeader = nonLeaderInfluentials.sort((a,b) => b.influence - a.influence)[0];

                   if (dissidentLeader) {
                       const leaderChar = activeCharacters.find(c => c.id === p!.leaderId);
                       const rebelAffiliationIds: string[] = [dissidentLeader.affiliationId];
                       
                       const dissidentAff = affiliationsMap.get(dissidentLeader.affiliationId);
                       const leaderAff = leaderChar ? affiliationsMap.get(leaderChar.affiliationId) : null;

                       if (dissidentAff && leaderAff) {
                            p.affiliationIds.forEach(affId => {
                                if (affId === dissidentLeader.affiliationId || affId === leaderChar?.affiliationId) return;
                                const aff = affiliationsMap.get(affId);
                                if (!aff) return;
                                
                                const distDissident = Math.sqrt(Math.pow(aff.ideology!.economic - dissidentAff.ideology!.economic, 2) + Math.pow(aff.ideology!.governance - dissidentAff.ideology!.governance, 2));
                                const distLeader = Math.sqrt(Math.pow(aff.ideology!.economic - leaderAff.ideology!.economic, 2) + Math.pow(aff.ideology!.governance - leaderAff.ideology!.governance, 2));

                                if (distDissident < distLeader) {
                                    rebelAffiliationIds.push(affId);
                                }
                            });
                       }

                       if (rebelAffiliationIds.length > 0) {
                            schismOccurred = true;
                            
                            let formNewParty = Math.random() < 0.7;
                            let targetParty: Party | undefined = undefined;

                            if (!formNewParty) {
                                const potentialTargets = activeParties.filter(t => {
                                    if (t.id === p!.id) return false;
                                    if (t.ethnicityFocus && t.ethnicityFocus !== dissidentLeader.ethnicity) return false;
                                    const dist = Math.sqrt(Math.pow(t.ideology.economic - dissidentAff!.ideology!.economic, 2) + Math.pow(t.ideology.governance - dissidentAff!.ideology!.governance, 2));
                                    return dist < 40; 
                                });

                                if (potentialTargets.length > 0) {
                                    potentialTargets.sort((a, b) => {
                                        const distA = Math.sqrt(Math.pow(a.ideology.economic - dissidentAff!.ideology!.economic, 2) + Math.pow(a.ideology.governance - dissidentAff!.ideology!.governance, 2));
                                        const distB = Math.sqrt(Math.pow(b.ideology.economic - dissidentAff!.ideology!.economic, 2) + Math.pow(b.ideology.governance - dissidentAff!.ideology!.governance, 2));
                                        return distA - distB;
                                    });
                                    targetParty = potentialTargets[0];
                                } else {
                                    formNewParty = true;
                                }
                            }
                            
                            if (formNewParty) {
                                let newPartyName = generatePartyName(dissidentAff);
                                let nameCounter = 1;
                                while (activeParties.some(ap => ap.name === newPartyName)) {
                                    newPartyName = `${newPartyName} (${nameCounter++})`;
                                }
                                
                                const res = handleAffiliationSecession(
                                    activeParties, activeCharacters, activeElectionResults,
                                    rebelAffiliationIds[0], dissidentLeader, 'new', { newPartyName }, date
                                );
                                activeParties = res.newParties;
                                activeCharacters = res.updatedCharacters;
                                activeElectionResults = res.newElectionResults;
                                
                                const createdPartyId = activeParties[activeParties.length - 1].id;
                                
                                for (let i = 1; i < rebelAffiliationIds.length; i++) {
                                    const affId = rebelAffiliationIds[i];
                                    const affLeader = activeCharacters.find(c => c.isAffiliationLeader && c.affiliationId === affId);
                                    if (affLeader) {
                                        const joinRes = handleAffiliationSecession(
                                            activeParties, activeCharacters, activeElectionResults,
                                            affId, affLeader, 'join', { targetPartyId: createdPartyId }, date
                                        );
                                        activeParties = joinRes.newParties;
                                        activeCharacters = joinRes.updatedCharacters;
                                        activeElectionResults = joinRes.newElectionResults;
                                    }
                                }
                                addToLog('Party Schism', `${dissidentLeader.name} has led a faction split from ${p.name} to form ${newPartyName}.`, 'politics');
                            
                            } else if (targetParty) {
                                const res = handleAffiliationSecession(
                                    activeParties, activeCharacters, activeElectionResults,
                                    rebelAffiliationIds[0], dissidentLeader, 'join', { targetPartyId: targetParty.id }, date
                                );
                                activeParties = res.newParties;
                                activeCharacters = res.updatedCharacters;
                                activeElectionResults = res.newElectionResults;

                                for (let i = 1; i < rebelAffiliationIds.length; i++) {
                                    const affId = rebelAffiliationIds[i];
                                    const affLeader = activeCharacters.find(c => c.isAffiliationLeader && c.affiliationId === affId);
                                    if (affLeader) {
                                        const joinRes = handleAffiliationSecession(
                                            activeParties, activeCharacters, activeElectionResults,
                                            affId, affLeader, 'join', { targetPartyId: targetParty.id }, date
                                        );
                                        activeParties = joinRes.newParties;
                                        activeCharacters = joinRes.updatedCharacters;
                                        activeElectionResults = joinRes.newElectionResults;
                                    }
                                }
                                addToLog('Party Defection', `${dissidentLeader.name} has led a faction split from ${p.name} to join ${targetParty.name}.`, 'politics');
                            }
                       }
                   }
               }
          }
      }

      // PHASE 3: Independent Alignment (Join Existing Parties)
      let affToPartyMap = getAffiliationToPartyMap();
      const initialIndependentAffs = AFFILIATIONS.filter(a => !affToPartyMap.has(a.id));
      
      initialIndependentAffs.forEach(aff => {
          const affLeader = activeCharacters.find(c => c.isAffiliationLeader && c.affiliationId === aff.id && c.isAlive);
          if (!affLeader) return;

          const currentAffStats = affiliationsMap.get(aff.id);
          const myIdeology = currentAffStats?.ideology || aff.baseIdeology || { economic: 50, governance: 50 };

          const potentialParties = activeParties.filter(p => {
    if (!canAffiliationJoinParty(aff, p)) return false; // Use helper
    const distEco = Math.abs(p.ideology.economic - myIdeology.economic);
    const distGov = Math.abs(p.ideology.governance - myIdeology.governance);
    const dist = Math.sqrt(distEco*distEco + distGov*distGov);
    return dist < 50; 
});

          // Increased probability of flocking to established parties
          if (potentialParties.length > 0 && Math.random() < 0.90) { 
              potentialParties.sort((a, b) => {
                   const distA = Math.sqrt(Math.pow(a.ideology.economic - myIdeology.economic, 2) + Math.pow(a.ideology.governance - myIdeology.governance, 2));
                   const distB = Math.sqrt(Math.pow(b.ideology.economic - myIdeology.economic, 2) + Math.pow(b.ideology.governance - myIdeology.governance, 2));
                   return distA - distB;
              });
              const target = potentialParties[0];
              
              const res = handleAffiliationSecession(
                  activeParties,
                  activeCharacters,
                  activeElectionResults,
                  aff.id,
                  affLeader,
                  'join',
                  { targetPartyId: target.id },
                  date
              );
              
              activeParties = res.newParties;
              activeCharacters = res.updatedCharacters;
              activeElectionResults = res.newElectionResults;
              addToLog('Political Alignment', `The independent ${aff.name} faction has aligned with ${target.name}.`, 'politics');
          }
      });

      // PHASE 4: AI Alliance Formation
      const viableForAlliance = activeParties.filter(p => {
          const inAlliance = activeAlliances.find(a => a.memberPartyIds.includes(p.id));
          if (inAlliance && inAlliance.leaderPartyId !== p.id) return false; 
          const hasSeats = Array.from(activeElectionResults.values()).filter(id => id === p.id).length > 0;
          return hasSeats || p.leaderId; 
      });

      const processedForAlliance = new Set<string>();
      
      for (const p1 of viableForAlliance) {
          if (processedForAlliance.has(p1.id)) continue;

          const existingAlliance = activeAlliances.find(a => a.leaderPartyId === p1.id);
          
          let bestPartner: Party | null = null;
          let minDistance = 30;

          for (const p2 of viableForAlliance) {
              if (p1.id === p2.id || processedForAlliance.has(p2.id)) continue;
              
              // CRITICAL CHECK: Ensure target is not in ANY alliance
              if (activeAlliances.some(a => a.memberPartyIds.includes(p2.id))) continue;

              const relation = p1.relations.get(p2.id) || 50;
              if (relation < 70) continue; 

              const dist = Math.sqrt(Math.pow(p1.ideology.economic - p2.ideology.economic, 2) + Math.pow(p1.ideology.governance - p2.ideology.governance, 2));
              if (dist > minDistance) continue;

              const p1Strict = !!p1.ethnicityFocus;
              const p2Strict = !!p2.ethnicityFocus;
              if (p1Strict && p2Strict && p1.ethnicityFocus !== p2.ethnicityFocus) {
                  if (relation < 85) continue;
              }

              bestPartner = p2;
              minDistance = dist; 
              break; 
          }

          if (bestPartner && Math.random() < 0.05) { 
               // Removed expansion logic ("Dominant Alliance Mechanic")
               if (!existingAlliance) {
                   // Ensure initiator isn't in another alliance (double safety check)
                   if (!activeAlliances.some(a => a.memberPartyIds.includes(p1.id))) {
                       const allianceName = generateAllianceName();
                       const newAlliance: PoliticalAlliance = {
                           id: `alliance-${Date.now()}-${Math.random()}`,
                           name: allianceName,
                           type: 'Alliance',
                           memberPartyIds: [p1.id, bestPartner.id],
                           leaderPartyId: p1.id 
                       };
                       
                       activeAlliances.push(newAlliance);
                       processedForAlliance.add(p1.id);
                       processedForAlliance.add(bestPartner.id);
                       addToLog('New Alliance', `${p1.name} and ${bestPartner.name} have formed the "${allianceName}"!`, 'politics');
                   }
               }
          }
      }

      // PHASE 5: Independent Coalition (Form New Party)
      affToPartyMap = getAffiliationToPartyMap();
      const remainingIndependentAffs = AFFILIATIONS.filter(a => !affToPartyMap.has(a.id));
      const processedIndependents = new Set<string>();

      const indepStats = new Map<string, { totalInf: number, leader: Character | null }>();
      activeCharacters.forEach(c => {
          if (c.isAlive && !affToPartyMap.has(c.affiliationId)) {
              const s = indepStats.get(c.affiliationId) || { totalInf: 0, leader: null };
              s.totalInf += c.influence;
              if (!s.leader || c.influence > s.leader.influence) s.leader = c;
              indepStats.set(c.affiliationId, s);
          }
      });

      const sortedIndependents = remainingIndependentAffs.sort((a,b) => {
          return (indepStats.get(b.id)?.totalInf || 0) - (indepStats.get(a.id)?.totalInf || 0);
      });

      for (const initiator of sortedIndependents) {
          if (processedIndependents.has(initiator.id)) continue;
          
          const stats = indepStats.get(initiator.id);
          if (!stats || stats.totalInf < 20 || !stats.leader) continue;

          const partners: Affiliation[] = [];
          
          for (const potential of sortedIndependents) {
              if (potential.id === initiator.id || processedIndependents.has(potential.id)) continue;
              
              const sameEth = initiator.ethnicity === potential.ethnicity;
              const i1 = affiliationsMap.get(initiator.id)?.ideology || initiator.baseIdeology!;
              const i2 = affiliationsMap.get(potential.id)?.ideology || potential.baseIdeology!;
              const dist = Math.sqrt(Math.pow(i1.economic - i2.economic, 2) + Math.pow(i1.governance - i2.governance, 2));
              
              if (sameEth || dist < 30) {
                  partners.push(potential);
              }
          }

          if (partners.length >= 2) {
               if (Math.random() > 0.1) continue;

               let partyName = generatePartyName(initiator); 
               
               if (activeParties.some(p => p.name === partyName)) {
                   partyName = `${partyName} (${date.getFullYear()})`;
               }

               const res1 = handleAffiliationSecession(
                  activeParties, activeCharacters, activeElectionResults,
                  initiator.id, stats.leader, 'new', { newPartyName: partyName }, date
               );
               activeParties = res1.newParties;
               activeCharacters = res1.updatedCharacters;
               activeElectionResults = res1.newElectionResults;
               
               const newParty = activeParties[activeParties.length - 1];
               processedIndependents.add(initiator.id);
               
               const partnerNames: string[] = [];
               for (const partner of partners) {
                   const pStats = indepStats.get(partner.id);
                   const pLeader = pStats?.leader || activeCharacters.find(c => c.affiliationId === partner.id && c.isAlive);
                   
                   if (pLeader) {
                        const resP = handleAffiliationSecession(
                            activeParties, activeCharacters, activeElectionResults,
                            partner.id, pLeader, 'join', { targetPartyId: newParty.id }, date
                        );
                        activeParties = resP.newParties;
                        activeCharacters = resP.updatedCharacters;
                        activeElectionResults = resP.newElectionResults;
                        
                        processedIndependents.add(partner.id);
                        partnerNames.push(partner.name);
                   }
               }

               addToLog('Party Formation', `The ${initiator.name} has rallied ${partnerNames.join(', ')} to form the ${newParty.name}!`, 'politics');
          }
      }
      
      // PHASE 6: Alliance Full Merger
      const mergerResult = attemptAllianceMerger(activeAlliances, activeParties);
      if (mergerResult) {
          const { mergedParty, dissolvedAllianceId, removedPartyIds } = mergerResult;
          const oldPartyNames = activeParties.filter(p => removedPartyIds.includes(p.id)).map(p => p.name).join(', ');

          // Update Parties
          activeParties = activeParties.filter(p => !removedPartyIds.includes(p.id));
          activeParties.push(mergedParty);

          // Remove Alliance
          activeAlliances = activeAlliances.filter(a => a.id !== dissolvedAllianceId);

          // Update Election Results (Seat Ownership)
          const removedSet = new Set(removedPartyIds);
          const newMap = new Map(activeElectionResults);
          activeElectionResults.forEach((partyId, seatCode) => {
              if (removedSet.has(partyId)) {
                  newMap.set(seatCode, mergedParty.id);
              }
          });
          activeElectionResults = newMap;
          
          // Update Character History for all affected members
          activeCharacters = activeCharacters.map(c => {
               // If their affiliation is now in the merged party
               if (mergedParty.affiliationIds.includes(c.affiliationId)) {
                   // Only log if they were in one of the removed parties before
                   // We don't have easy access to prev state here without lookup, but since affiliations are distinct to parties usually:
                   // The fact that mergedParty has this affiliation implies it came from one of the removed ones.
                   return { 
                       ...c, 
                       history: [...c.history, { date: date, event: `Party merged into ${mergedParty.name}.` }] 
                   };
               }
               return c;
          });

          addToLog('Historic Merger', `${oldPartyNames} have officially merged to form the single unified party: ${mergedParty.name}!`, 'politics');
      }

      // PHASE 7: Party Consolidation
      // Recalculate seats for consolidation logic
      const currentSeatCounts = getPartySeatCounts(activeElectionResults, new Map(activeParties.map(p => [p.id, p])));
      const weakParties = activeParties.filter(p => (currentSeatCounts.get(p.id) || 0) === 0 && p.id !== playerParty?.id);
      
      const consolidationProcessed = new Set<string>();

      for (const weakP of weakParties) {
          if (consolidationProcessed.has(weakP.id)) continue;
          
          // 2% chance per update tick
          if (Math.random() > 0.02) continue;

          // Find best partner
          let target: Party | null = null;
          let bestScore = -1;

          for (const otherP of activeParties) {
              if (otherP.id === weakP.id) continue;
              if (consolidationProcessed.has(otherP.id)) continue;
              if (otherP.id === playerParty?.id) continue; // Don't merge with player auto

              // Ethnicity Check
              if (weakP.ethnicityFocus && otherP.ethnicityFocus && weakP.ethnicityFocus !== otherP.ethnicityFocus) continue;
              if (weakP.ethnicityFocus && !otherP.ethnicityFocus) continue; // Prefer not to lose identity unless desperation? strict for now

              // Ideology Check (Close enough?)
              const dist = Math.sqrt(Math.pow(weakP.ideology.economic - otherP.ideology.economic, 2) + Math.pow(weakP.ideology.governance - otherP.ideology.governance, 2));
              if (dist > 25) continue;

              // Relations Check
              const rel = weakP.relations.get(otherP.id) || 50;
              if (rel < 40) continue;

              const seats = currentSeatCounts.get(otherP.id) || 0;
              // Score based on size (prefer bigger) and ideology match
              const score = (seats * 20) + (100 - dist) + rel;
              
              if (score > bestScore) {
                  bestScore = score;
                  target = otherP;
              }
          }

          if (target) {
              const targetSeats = currentSeatCounts.get(target.id) || 0;
              
              if (targetSeats > 0) {
                  // Absorption
                  const res = handlePartyAbsorption(
                      activeParties, target.id, [weakP], [], activeElectionResults, activeCharacters, date
                  );
                  activeParties = res.newParties;
                  activeCharacters = res.updatedCharacters;
                  activeElectionResults = res.newElectionResults;
                  consolidationProcessed.add(weakP.id);
                  addToLog('Party Absorbed', `${weakP.name} has been absorbed by ${target.name} due to poor performance.`, 'politics');
              } else {
                  // Merger of equals
                  if (!consolidationProcessed.has(target.id)) {
                      // Pick leader
                      const l1 = activeCharacters.find(c => c.id === weakP.leaderId);
                      const l2 = activeCharacters.find(c => c.id === target?.leaderId);
                      const newLeaderId = (l1?.influence || 0) > (l2?.influence || 0) ? weakP.leaderId : target.leaderId;
                      
                      // Fallback name generation based on dominant affiliation
                      const affId = weakP.affiliationIds[0] || target.affiliationIds[0];
                      const newName = generatePartyName(affiliationsMap.get(affId));
                      
                      const res = handlePartyMerger(
                          activeParties, weakP.id, [target], [], newName, newLeaderId || '', undefined, activeElectionResults, activeCharacters, date
                      );
                      
                      activeParties = res.newParties;
                      activeCharacters = res.updatedCharacters;
                      activeElectionResults = res.newElectionResults;
                      
                      consolidationProcessed.add(weakP.id);
                      consolidationProcessed.add(target.id);
                      addToLog('Party Merger', `${weakP.name} and ${target.name} have merged to form ${newName} to pool resources.`, 'politics');
                  }
              }
          }
      }

      setParties(activeParties);
      setCharacters(activeCharacters);
      setElectionResults(activeElectionResults);
      setAlliances(activeAlliances);
  };

  const handleStatePartyElections = (date: Date) => {
      let updatedParties = [...parties];
      let updatedCharacters = [...characters];
      const allRoleChanges: { charId: string, event: string }[] = [];

      updatedParties = updatedParties.map(p => {
          const { updatedParty, roleChanges } = electStateLeadersAndExecutives(p, updatedCharacters, uniqueStates);
          roleChanges.forEach(rc => allRoleChanges.push(rc));
          return updatedParty;
      });

      const changesMap = new Map<string, string[]>();
      allRoleChanges.forEach(rc => {
          if (!changesMap.has(rc.charId)) changesMap.set(rc.charId, []);
          changesMap.get(rc.charId)?.push(rc.event);
      });

      updatedCharacters = updatedCharacters.map(c => {
          const events = changesMap.get(c.id);
          if (events) {
              const newEntries = events.map(e => ({ date: date, event: e }));
              return { ...c, history: [...c.history, ...newEntries] };
          }
          return c;
      });
      
      updatedCharacters = updateAffiliationLeaders(updatedCharacters, AFFILIATIONS);

      setParties(updatedParties);
      setCharacters(updatedCharacters);
  };
  
  // Reusable party election logic for AI
  const handlePartyElectionAuto = (party: Party, date: Date) => {
      const partyMembers = characters.filter(c => party.affiliationIds.includes(c.affiliationId) && c.isAlive);
      const candidates = partyMembers.filter(c => {
          const isStateLeader = party.stateBranches.some(b => b.leaderId === c.id);
          const isIncumbent = party.leaderId === c.id;
          return isStateLeader || isIncumbent;
      });

      const validVoterIds = new Set<string>();
      party.stateBranches.forEach(branch => {
          if (branch.leaderId) validVoterIds.add(branch.leaderId);
          branch.executiveIds.forEach(id => validVoterIds.add(id));
      });
      characters.forEach(c => {
         if (c.isAffiliationLeader && party.affiliationIds.includes(c.affiliationId) && c.isAlive) {
             validVoterIds.add(c.id);
         }
      });
      const voters = characters.filter(c => validVoterIds.has(c.id) && c.isAlive);

      const { leaderId, deputyLeaderId } = conductPartyLeadershipElection(voters, candidates);
      
      // Update
      setParties(prev => prev.map(p => {
         if (p.id === party.id) {
             let newLeaderHistory = [...p.leaderHistory];
             // Close previous term if leader changed and old leader existed
             if (leaderId !== p.leaderId && leaderId) {
                 if (newLeaderHistory.length > 0) {
                     const lastEntry = newLeaderHistory[newLeaderHistory.length - 1];
                     // Only close if not already closed
                     if (!lastEntry.endDate) {
                        newLeaderHistory[newLeaderHistory.length - 1] = { ...lastEntry, endDate: date };
                     }
                 }
                 newLeaderHistory.push({ 
                     leaderId, 
                     name: characters.find(c=>c.id===leaderId)?.name || 'Unknown', 
                     startDate: date 
                 });
             }

             return { 
                 ...p, 
                 leaderId, 
                 deputyLeaderId,
                 leaderHistory: newLeaderHistory
             };
         }
         return p;
     }));

     if (leaderId) {
         setCharacters(prev => prev.map(c => {
             if (c.id === leaderId) return { ...c, history: [...c.history, { date, event: `Elected National Leader of ${party.name}.` }]};
             if (c.id === deputyLeaderId) return { ...c, history: [...c.history, { date, event: `Elected Deputy Leader of ${party.name}.` }]};
             return c;
         }));
     }
  };

  const runAIStrategies = () => {
      let currentPartiesMap = new Map(parties.map(p => [p.id, p]));
      const allianceMap = new Map<string, string>(); 
      
      alliances.forEach(a => {
          a.memberPartyIds.forEach(pid => allianceMap.set(pid, a.id));
      });

      const processedPartyIds = new Set<string>();

      // 1. Process Alliances: Distribute seats to avoid friendly fire
      alliances.forEach(alliance => {
          const members = alliance.memberPartyIds.map(id => currentPartiesMap.get(id)).filter(Boolean) as Party[];
          if (members.length > 0) {
              const distributedMembers = distributeAllianceSeats(
                  alliance,
                  members,
                  allSeatCodes,
                  demographicsMap,
                  featuresMap,
                  affiliationsMap,
                  characters,
                  strongholdMap
              );
              
              distributedMembers.forEach(p => {
                  currentPartiesMap.set(p.id, p);
                  processedPartyIds.add(p.id);
              });
          }
      });

      // 2. Run Individual AI Strategy
      let finalParties = Array.from(currentPartiesMap.values());
      let updatedCharacters = [...characters];

      finalParties = finalParties.map(party => {
          let skipStrategy = false;
          const skipAffiliationIds: string[] = [];

          if (playerParty && party.id === playerParty.id && playerCharacter) {
              if (playerCharacter.id === party.leaderId) skipStrategy = true;
              if (playerCharacter.isAffiliationLeader) skipAffiliationIds.push(playerCharacter.affiliationId);
          }
          
          if (allianceMap.has(party.id) && !skipStrategy) {
             skipStrategy = true; 
          }

          const { updatedParty, historyUpdates } = aiFullElectionStrategy(
              party,
              updatedCharacters,
              allSeatCodes,
              featuresMap,
              demographicsMap,
              affiliationsMap,
              currentDate,
              strongholdMap,
              skipStrategy,
              skipAffiliationIds
          );
          
          historyUpdates.forEach(update => {
              const charIndex = updatedCharacters.findIndex(c => c.id === update.charId);
              if (charIndex !== -1) {
                  updatedCharacters[charIndex] = {
                      ...updatedCharacters[charIndex],
                      history: [...updatedCharacters[charIndex].history, update.entry]
                  };
              }
          });

          return updatedParty;
      });

      setParties(finalParties);
      setCharacters(updatedCharacters);
  };

  const generateInitialNPCs = (playerChar: Character | null) => {
      const newNPCs: Character[] = [];
      
      // Iterate through every constituency
      allSeatCodes.forEach(seatCode => {
          const seat = featuresMap.get(seatCode);
          const demographics = demographicsMap.get(seatCode);
          const state = seat?.properties.NEGERI || 'Unknown';
          let seatCharCount = 0;
          
          if (playerChar && playerChar.currentSeatCode === seatCode) seatCharCount++;

          const shuffledAffiliations = [...AFFILIATIONS].sort(() => Math.random() - 0.5);

          for (const affiliation of shuffledAffiliations) {
              if (seatCharCount >= 40) break;
              
              if (demographics) {
                let populationPercent = 0;
                if (affiliation.ethnicity === 'Malay') populationPercent = demographics.malayPercent;
                else if (affiliation.ethnicity === 'Chinese') populationPercent = demographics.chinesePercent;
                else if (affiliation.ethnicity === 'Indian') populationPercent = demographics.indianPercent;
                else if (affiliation.ethnicity === 'Others') populationPercent = demographics.othersPercent;
                
                if (populationPercent < 0.5) {
                    continue;
                }
              }

              const baseIdeology = affiliation.baseIdeology || { economic: 50, governance: 50 };
              const randomIdeology: Ideology = {
                  economic: Math.max(0, Math.min(100, baseIdeology.economic + (Math.random() * 30 - 15))),
                  governance: Math.max(0, Math.min(100, baseIdeology.governance + (Math.random() * 30 - 15)))
              };

              newNPCs.push({
                  id: `npc-${seatCode}-${affiliation.id}-${Math.random().toString(36).substr(2, 9)}`,
                  name: generateCharacterName(affiliation.ethnicity),
                  affiliationId: affiliation.id,
                  ethnicity: affiliation.ethnicity,
                  state: state,
                  currentSeatCode: seatCode,
                  charisma: 20 + Math.floor(Math.random() * 60),
                  influence: 10 + Math.floor(Math.random() * 50),
                  recognition: 5 + Math.floor(Math.random() * 30),
                  dateOfBirth: new Date(1900 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), 1),
                  isAlive: true,
                  isPlayer: false,
                  isMP: false,
                  history: [],
                  ideology: randomIdeology
              });
              seatCharCount++;
          }
      });

      const updatedParties = parties.map(p => {
          const members = newNPCs.filter(c => p.affiliationIds.includes(c.affiliationId));
          if (members.length > 0) {
              members.sort((a, b) => b.influence - a.influence);
              p.leaderId = members[0].id;
              p.deputyLeaderId = members.length > 1 ? members[1].id : undefined;
              
              if (p.leaderId) {
                  const leader = members[0];
                  leader.history.push({ date: START_DATE, event: `Became the leader of ${p.name}.` });
                  p.leaderHistory = [{ leaderId: leader.id, name: leader.name, startDate: START_DATE }];
              }
          }
          
          // INITIALIZE STRONG ALLIANCE COHESION
          // Force high unity and relations for The Alliance (UMNO, MCA, MIC)
          const allianceMembers = ['umno', 'mca', 'mic'];
          if (allianceMembers.includes(p.id)) {
              p.unity = 100; // Absolute unity at start
          }

          return p;
      });
      
      let partiesWithRelations = initializePartyRelations(updatedParties);
      
      // Re-enforce high relations for Alliance members specifically after random initialization
      partiesWithRelations = partiesWithRelations.map(p => {
          const allianceMembers = ['umno', 'mca', 'mic'];
          if (allianceMembers.includes(p.id)) {
              const newRelations = new Map(p.relations);
              allianceMembers.forEach(allyId => {
                  if (allyId !== p.id) {
                      newRelations.set(allyId, 100); // Maximum relations
                  }
              });
              return { ...p, relations: newRelations };
          }
          return p;
      });
      
      setParties(partiesWithRelations);
      return newNPCs;
  };

  const handleStartGame = () => setGameState('party-selection');
  
  const handleSpectatorStart = () => {
      // Start as spectator
      const npcs = generateInitialNPCs(null);
      let allCharacters = npcs;
      
      allCharacters = updateAffiliationLeaders(allCharacters, AFFILIATIONS);
      const updatedAffiliations = updateAffiliationIdeologies(allCharacters, AFFILIATIONS);
      setAffiliationsMap(new Map(updatedAffiliations.map(a => [a.id, a])));
      setParties(prev => updatePartyIdeologies(prev, updatedAffiliations));

      setCharacters(allCharacters);
      setPlayerCharacterId(null);
      setObserveMode(true);
      setGameState('game');
  };
  
  const handlePartySelect = (party: Party) => {
      setSelectedPartyId(party.id); 
      setGameState('character-selection');
  };

  const handleCharacterSelect = (char: Omit<Character, 'currentSeatCode' | 'dateOfBirth' | 'isAlive' | 'ideology'>) => {
      const dob = new Date(START_DATE.getFullYear() - (25 + Math.floor(Math.random() * 30)), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28));
      const affiliation = affiliationsMap.get(char.affiliationId);
      const baseIdeology = affiliation?.baseIdeology || { economic: 50, governance: 50 };

      const partialCharacter: Omit<Character, 'currentSeatCode'> = {
          ...char,
          dateOfBirth: dob,
          isAlive: true,
          isPlayer: true,
          ideology: { // Player starts close to affiliation baseline
              economic: Math.max(0, Math.min(100, baseIdeology.economic + (Math.random() * 10 - 5))),
              governance: Math.max(0, Math.min(100, baseIdeology.governance + (Math.random() * 10 - 5)))
          }
      };
      
      setPendingCharacter(partialCharacter);
      setGameState('position-selection');
  };

  const handlePositionSelect = (seatCode: string) => {
      if (!pendingCharacter) return;

      const newPlayerCharacter: Character = {
          ...pendingCharacter,
          currentSeatCode: seatCode,
      };

      const npcs = generateInitialNPCs(newPlayerCharacter);
      
      let allCharacters = [newPlayerCharacter, ...npcs];
      allCharacters = updateAffiliationLeaders(allCharacters, AFFILIATIONS);
      
      const updatedAffiliations = updateAffiliationIdeologies(allCharacters, AFFILIATIONS);
      setAffiliationsMap(new Map(updatedAffiliations.map(a => [a.id, a])));
      setParties(prev => updatePartyIdeologies(prev, updatedAffiliations));

      setCharacters(allCharacters);
      setPlayerCharacterId(newPlayerCharacter.id);
      setPendingCharacter(null);
      setGameState('game');
      setSelectedSeatCode(seatCode);
  };

  const handleGeneralElection = (electionDay: Date) => {
    setGameState('election-results');
    setGovernment(null);
    setHasPlayerManagedStrategy(false);
    setHasPlayerManagedAffiliation(false);
    
    // Force Move Candidates to Seats
    const candidateSeatMoves = new Map<string, string>();
    parties.forEach(p => {
        p.contestedSeats.forEach((data, seatCode) => {
            if (data.candidateId) {
                candidateSeatMoves.set(data.candidateId, seatCode);
            }
        });
    });

    const charactersForElection = characters.map(c => {
        const targetSeat = candidateSeatMoves.get(c.id);
        if (targetSeat && targetSeat !== c.currentSeatCode) {
            return { ...c, currentSeatCode: targetSeat };
        }
        return c;
    });

    const newWinningPartyResults = new Map<string, string>(); 
    const newDetailedResults = new Map<string, Map<string, number>>(); 
    const seatWinners = new Map<string, SeatWinner>();
    const newSeatCandidates = new Map<string, Map<string, { id: string, name: string }>>();
    const newMPs = new Set<string>();
    let totalCurrentVotes = 0;
    let totalElectorate = 0;

    const allianceMemberMap = new Map<string, Set<string>>();
    alliances.forEach(alliance => {
        const members = new Set<string>(alliance.memberPartyIds);
        alliance.memberPartyIds.forEach(pid => {
            allianceMemberMap.set(pid, members);
        });
    });

    const allSeatVotes = new Map<string, Map<string, number>>(); 

    allSeatCodes.forEach(seatCode => {
        const seatFeature = featuresMap.get(seatCode);
        const demographics = demographicsMap.get(seatCode);
        if (!seatFeature) return;

        const electorate = demographics ? demographics.totalElectorate : 10000; 
        totalElectorate += electorate;

        const partyInfluenceScores = new Map<string, number>();
        const charactersInSeat = charactersForElection.filter(c => c.currentSeatCode === seatCode && c.isAlive);
        const contestingPartiesInSeat = parties.filter(p => p.contestedSeats.has(seatCode));
        const seatCandidateMap = new Map<string, { id: string, name: string }>();

        contestingPartiesInSeat.forEach(contestingParty => {
            let partyTotal = 0;
            const allianceMembers = allianceMemberMap.get(contestingParty.id);
            
            const contestData = contestingParty.contestedSeats.get(seatCode);
            if (contestData?.candidateId) {
                const candidate = charactersForElection.find(c => c.id === contestData.candidateId);
                if (candidate) {
                     seatCandidateMap.set(contestingParty.id, { id: candidate.id, name: candidate.name });
                }
            }

            charactersInSeat.forEach(char => {
                const charPartyId = affiliationToPartyMap.get(char.affiliationId);
                if (!charPartyId) return;

                const isContributor = (charPartyId === contestingParty.id) || (allianceMembers && allianceMembers.has(charPartyId));

                if (isContributor) {
                     const charInfluence = calculateEffectiveInfluence(
                         char, 
                         seatFeature, 
                         demographics || null, 
                         affiliationsMap,
                         strongholdMap, 
                         contestData?.candidateId, 
                         contestData?.allocatedAffiliationId
                     );
                     partyTotal += charInfluence;
                }
            });
            
            partyInfluenceScores.set(contestingParty.id, partyTotal);
        });
        
        newSeatCandidates.set(seatCode, seatCandidateMap);
        
        const finalPartyScores = new Map<string, number>();
        let finalTotalScore = 0;
        
        partyInfluenceScores.forEach((score, pId) => {
             const variance = 0.85 + (Math.random() * 0.3); 
             const adjustedScore = score * variance;
             finalPartyScores.set(pId, adjustedScore);
             finalTotalScore += adjustedScore;
        });

        const seatVotes = new Map<string, number>();
        let seatTotalVotes = 0;
        
        const turnoutRate = 0.65 + (Math.random() * 0.2);
        const validVotes = Math.floor(electorate * turnoutRate);

        finalPartyScores.forEach((score, pId) => {
            const voteShare = finalTotalScore > 0 ? score / finalTotalScore : 0;
            const votes = Math.floor(voteShare * validVotes);
            
            seatVotes.set(pId, votes);
            seatTotalVotes += votes;
        });
        
        allSeatVotes.set(seatCode, seatVotes);
        newDetailedResults.set(seatCode, seatVotes);
        totalCurrentVotes += seatTotalVotes;
    });

    const seatAllocations = new Map<string, string>(); 

    if (electionSystem === 'FPTP') {
        allSeatVotes.forEach((votesMap, seatCode) => {
             let maxVotes = -1;
             let winningPartyId = '';

             votesMap.forEach((votes, pId) => {
                 if (votes > maxVotes) {
                     maxVotes = votes;
                     winningPartyId = pId;
                 }
             });

             if (winningPartyId) {
                 seatAllocations.set(seatCode, winningPartyId);
             }
        });
    } else if (electionSystem === 'PR') {
        const nationalVotes = new Map<string, number>();
        let totalNationalVotes = 0;

        allSeatVotes.forEach((votesMap) => {
            votesMap.forEach((votes, pId) => {
                nationalVotes.set(pId, (nationalVotes.get(pId) || 0) + votes);
                totalNationalVotes += votes;
            });
        });

        const totalSeats = allSeatCodes.length;
        const targetSeats = new Map<string, number>();
        const remainders = new Map<string, number>();
        let allocatedCount = 0;

        nationalVotes.forEach((votes, pId) => {
            const share = (votes / totalNationalVotes) * totalSeats;
            const seats = Math.floor(share);
            targetSeats.set(pId, seats);
            remainders.set(pId, share - seats);
            allocatedCount += seats;
        });

        const sortedRemainders = [...remainders.entries()].sort((a,b) => b[1] - a[1]);
        let rIndex = 0;
        while (allocatedCount < totalSeats && rIndex < sortedRemainders.length) {
            const pId = sortedRemainders[rIndex][0];
            targetSeats.set(pId, (targetSeats.get(pId) || 0) + 1);
            allocatedCount++;
            rIndex++;
        }

        const performanceList: { seatCode: string, partyId: string, percent: number }[] = [];
        allSeatVotes.forEach((votesMap, seatCode) => {
            let seatTotal = 0;
            votesMap.forEach(v => seatTotal += v);
            if (seatTotal > 0) {
                votesMap.forEach((votes, pId) => {
                    performanceList.push({ seatCode, partyId: pId, percent: votes / seatTotal });
                });
            }
        });

        performanceList.sort((a, b) => b.percent - a.percent);

        const assignedSeats = new Set<string>();
        const partyWinCounts = new Map<string, number>();
        
        parties.forEach(p => partyWinCounts.set(p.id, 0));

        for (const perf of performanceList) {
            if (assignedSeats.has(perf.seatCode)) continue;
            const currentWins = partyWinCounts.get(perf.partyId) || 0;
            const quota = targetSeats.get(perf.partyId) || 0;
            
            if (currentWins < quota) {
                seatAllocations.set(perf.seatCode, perf.partyId);
                assignedSeats.add(perf.seatCode);
                partyWinCounts.set(perf.partyId, currentWins + 1);
            }
        }

        if (assignedSeats.size < totalSeats) {
             for (const perf of performanceList) {
                if (!assignedSeats.has(perf.seatCode)) {
                     seatAllocations.set(perf.seatCode, perf.partyId);
                     assignedSeats.add(perf.seatCode);
                }
             }
        }
    }
    
    // Update Stronghold Map
    const newStrongholdMap = new Map(strongholdMap);

    seatAllocations.forEach((winningPartyId, seatCode) => {
        newWinningPartyResults.set(seatCode, winningPartyId);
        
        const party = partiesMap.get(winningPartyId);
        const contestData = party?.contestedSeats.get(seatCode);
        const candidateId = contestData?.candidateId;

        if (candidateId) {
            newMPs.add(candidateId);
             const candidate = charactersForElection.find(c => c.id === candidateId);
             if (candidate) {
                  seatWinners.set(seatCode, {
                      partyId: winningPartyId,
                      candidateId: candidateId,
                      candidateName: candidate.name
                  });
                  
                  // Stronghold Logic
                  const currentStronghold = newStrongholdMap.get(seatCode);
                  if (currentStronghold && currentStronghold.affiliationId === candidate.affiliationId) {
                      newStrongholdMap.set(seatCode, { affiliationId: candidate.affiliationId, terms: currentStronghold.terms + 1 });
                  } else {
                      newStrongholdMap.set(seatCode, { affiliationId: candidate.affiliationId, terms: 1 });
                  }
             }
        } else {
             // Party won without specific candidate assigned (fallback logic or PR allocation to party list not fully impl for strongholds)
             // For now, reset stronghold if no candidate to trace affiliation
             newStrongholdMap.delete(seatCode);
        }
    });
    
    setStrongholdMap(newStrongholdMap);

    const historyEntry: ElectionHistoryEntry = {
        date: electionDay,
        results: newWinningPartyResults,
        detailedResults: newDetailedResults,
        seatWinners: seatWinners,
        seatCandidates: newSeatCandidates,
        totalElectorate: totalElectorate,
        totalVotes: totalCurrentVotes,
        totalSeats: allSeatCodes.length,
        alliances: JSON.parse(JSON.stringify(alliances)),
        parties: JSON.parse(JSON.stringify(parties)),
    };
    setElectionHistory(prevHistory => [...prevHistory, historyEntry]);

    setElectionResults(newWinningPartyResults);
    setDetailedElectionResults(newDetailedResults);

    const candidateContests = new Map<string, string>();
    parties.forEach(p => {
        p.contestedSeats.forEach((data, seatCode) => {
            if (data.candidateId) {
                candidateContests.set(data.candidateId, seatCode);
            }
        });
    });

    setCharacters(prevChars => {
         return prevChars.map(char => {
            let updatedChar = { ...char };
            const targetSeat = candidateSeatMoves.get(char.id);
            if (targetSeat && targetSeat !== char.currentSeatCode) {
                updatedChar.currentSeatCode = targetSeat;
            }
            
            const wasMP = char.isMP;
            const isNowMP = newMPs.has(char.id);
            let newHistory = char.history;

            const contestedSeatCode = candidateContests.get(char.id);
            const seatName = contestedSeatCode ? featuresMap.get(contestedSeatCode)?.properties.PARLIMEN : (featuresMap.get(char.currentSeatCode)?.properties.PARLIMEN || 'Unknown');

            if (isNowMP) {
                 if (!wasMP) {
                     newHistory = [...newHistory, { date: electionDay, event: `Won election in ${seatName}, becoming a Member of Parliament.` }];
                 } else {
                     newHistory = [...newHistory, { date: electionDay, event: `Re-elected in ${seatName}.` }];
                 }
            } else {
                if (wasMP) {
                    if (contestedSeatCode) {
                        newHistory = [...newHistory, { date: electionDay, event: `Defeated in ${seatName}, losing seat.` }];
                    } else {
                         newHistory = [...newHistory, { date: electionDay, event: `Did not contest, losing seat.` }];
                    }
                } else if (contestedSeatCode) {
                     newHistory = [...newHistory, { date: electionDay, event: `Defeated in election for ${seatName}.` }];
                }
            }

            return { ...updatedChar, history: newHistory, isMP: isNowMP };
        });
    });
};

  const handlePartyElectionStart = (party: Party) => {
      const partyMembers = characters.filter(c => party.affiliationIds.includes(c.affiliationId) && c.isAlive);
      const candidates = partyMembers.filter(c => {
          const isStateLeader = party.stateBranches.some(b => b.leaderId === c.id);
          const isIncumbent = party.leaderId === c.id;
          return isStateLeader || isIncumbent;
      });
      
      setPartyElectionData({ party, candidates });
      setGameState('party-election-voting');
  };

  const handlePartyVote = (candidateId?: string) => {
     if (!partyElectionData) return;
     const currentElectionData = partyElectionData;

     const party = currentElectionData.party;

     const validVoterIds = new Set<string>();
     
     party.stateBranches.forEach(branch => {
         if (branch.leaderId) validVoterIds.add(branch.leaderId);
         branch.executiveIds.forEach(id => validVoterIds.add(id));
     });

     characters.forEach(c => {
         if (c.isAffiliationLeader && party.affiliationIds.includes(c.affiliationId) && c.isAlive) {
             validVoterIds.add(c.id);
         }
     });

     const voters = characters.filter(c => validVoterIds.has(c.id) && c.isAlive);
     const npcVoters = voters.filter(c => !c.isPlayer);
     
     const { leaderId, deputyLeaderId, voteTally } = conductPartyLeadershipElection(npcVoters, currentElectionData.candidates);
     
     const isPlayerEligible = playerCharacterId ? validVoterIds.has(playerCharacterId) : false;

     if (candidateId && isPlayerEligible) {
        const currentVotes = voteTally.get(candidateId) || 0;
        voteTally.set(candidateId, currentVotes + 1);
     }
     
     const sorted = Array.from(voteTally.entries()).sort((a,b) => b[1] - a[1]);
     const finalLeaderId = sorted.length > 0 ? sorted[0][0] : undefined;
     const finalDeputyId = sorted.length > 1 ? sorted[1][0] : undefined;
     
     setParties(prev => prev.map(p => {
         if (p.id === currentElectionData.party.id) {
             let newLeaderHistory = [...p.leaderHistory];
             // Close previous term if needed
             if (finalLeaderId !== p.leaderId && finalLeaderId) {
                 if (newLeaderHistory.length > 0) {
                     const lastEntry = newLeaderHistory[newLeaderHistory.length - 1];
                     if (!lastEntry.endDate) {
                        newLeaderHistory[newLeaderHistory.length - 1] = { ...lastEntry, endDate: currentDate };
                     }
                 }
                 newLeaderHistory.push({ 
                     leaderId: finalLeaderId, 
                     name: characters.find(c=>c.id===finalLeaderId)?.name || 'Unknown', 
                     startDate: currentDate 
                 });
             }

             return { 
                 ...p, 
                 leaderId: finalLeaderId, 
                 deputyLeaderId: finalDeputyId,
                 leaderHistory: newLeaderHistory
             };
         }
         return p;
     }));

     setCharacters(prev => prev.map(c => {
         if (c.id === finalLeaderId) return { ...c, history: [...c.history, { date: currentDate, event: `Elected National Leader of ${currentElectionData.party.name}.` }]};
         if (c.id === finalDeputyId) return { ...c, history: [...c.history, { date: currentDate, event: `Elected Deputy Leader of ${currentElectionData.party.name}.` }]};
         return c;
     }));

     setPartyElectionData({ ...currentElectionData, voteTally, winnerId: finalLeaderId, deputyWinnerId: finalDeputyId });
     setGameState('party-election-results');
  };

  const handleSpeakerElectionStart = () => {
      const candidates = determineSpeakerCandidates(electionResults, parties, characters);
      setSpeakerElectionData({ candidates });
      setGameState('speaker-election-voting');
  };
  
  const handleSpeakerVote = (voteId?: string) => {
     if (!speakerElectionData) return;
     const currentElectionData = speakerElectionData; 

     const results = conductSpeakerVote(
         electionResults, 
         parties, 
         currentElectionData.candidates, 
         affiliationToPartyMap, 
         playerParty?.id || 'independent', 
         voteId || '' // Use empty string if undefined (spectator mode)
     );
     
     setCharacters(prev => prev.map(c => {
         if (c.id === results.winnerId) return { ...c, isMP: true, currentSeatCode: 'SPEAKER', history: [...c.history, { date: currentDate, event: 'Elected as Speaker of Parliament.' }] };
         return c;
     }));

     setSpeakerElectionData({ ...currentElectionData, results: { winner: currentElectionData.candidates.find(c => c.id === results.winnerId)!, tally: results.tally, breakdown: results.breakdown } });
     setGameState('speaker-election-results');
  };

  const handleGovernmentFormation = (coalitionIds?: string[]) => {
      const { government: newGovernment, updatedCharacters } = formGovernment(electionResults, parties, characters, currentDate, alliances, coalitionIds);
      setGovernment(newGovernment);
      setCharacters(updatedCharacters);
      
      // Regime Check
      const newLeaderPartyId = newGovernment.rulingCoalitionIds[0];
      const prevLeaderPartyId = regimeLeaderPartyId;

      // Logic: Same party leading, or same alliance structure?
      // For simplicity: If the new leader party is the same as the old one, OR if they are in the same alliance
      let isSameRegime = false;
      if (newLeaderPartyId === prevLeaderPartyId) {
          isSameRegime = true;
      } else {
          // Check alliances
          const oldAlliance = alliances.find(a => a.memberPartyIds.includes(prevLeaderPartyId || ''));
          const newAlliance = alliances.find(a => a.memberPartyIds.includes(newLeaderPartyId));
          if (oldAlliance && newAlliance && oldAlliance.id === newAlliance.id) {
              isSameRegime = true;
          }
      }

      if (isSameRegime) {
          // Continue regime count
      } else {
          setRegimeStartDate(currentDate);
          setBigTentTriggered(false); // Reset event trigger
          setRegimeLeaderPartyId(newLeaderPartyId);
      }
      
      handleSpeakerElectionStart();
  };
  
  const startGovernmentFormationFlow = () => {
      const seatCounts = getPartySeatCounts(electionResults, new Map(parties.map(p => [p.id, p])));
      const playerPartySeats = playerParty ? seatCounts.get(playerParty.id) || 0 : 0;
      const isPlayerLeader = playerParty && playerParty.leaderId === playerCharacterId;
      
      const sortedParties = Array.from(seatCounts.entries()).sort((a, b) => b[1] - a[1]);
      const isTopParty = playerParty && sortedParties.slice(0, 3).some(p => p[0] === playerParty.id);

      if (isPlayerLeader && playerPartySeats > 0 && isTopParty) {
          setGameState('government-formation');
      } else {
          handleGovernmentFormation();
      }
  };
  
  const handleVoteOfConfidence = () => {
      if(!government) return;
      const result = conductVoteOfConfidence(government, characters, parties, electionResults);
      addToLog('Vote of Confidence', `Results: ${result.votesFor} For, ${result.votesAgainst} Against. Result: ${result.passed ? "Passed" : "Failed"}.`, 'politics');
  };

  const handleBillProposal = () => {
      setGameState('bill-selection');
      setShowParliament(false); 
  };

  const handleBillSelect = (billTemplate: Omit<Bill, 'proposingPartyId'>) => {
      if (!playerParty) return;
      const bill: Bill = { ...billTemplate, proposingPartyId: playerParty.id };
      setParliamentBill(bill);
      setGameState('bill-proposal');
  };

  const handleBillVote = (playerVote: VoteDirection) => {
      if (!parliamentBill) return;
      
      const tally: BillVoteTally = { Aye: 0, Nay: 0, Abstain: 0 };
      const breakdown: BillVoteBreakdown = new Map();
      const seatCounts = new Map<string, number>();
      parties.forEach(p => seatCounts.set(p.id, 0));
      for (const partyId of electionResults.values()) {
          seatCounts.set(partyId, (seatCounts.get(partyId) || 0) + 1);
      }

      parties.forEach(party => {
          let vote: VoteDirection;
          if (playerParty && party.id === playerParty.id) {
              vote = playerVote;
          } else {
             vote = aiDecideBillVote(party, parliamentBill);
          }
          
          const seats = seatCounts.get(party.id) || 0;
          tally[vote] += seats;
          breakdown.set(party.id, vote);
      });
      
      const totalMembers = allSeatCodes.length; 
      
      let passed = false;
      if (parliamentBill.isConstitutional) {
          passed = tally.Aye >= Math.ceil(totalMembers * 2 / 3);
      } else {
          passed = tally.Aye > tally.Nay;
      }
      
      if (passed && parliamentBill.id === 'const_prop_rep') {
          setElectionSystem('PR');
          addToLog('Constitutional Amendment', "Proportional Representation Act passed. Future elections will use PR.", 'politics');
      }

      setBillVoteResults({ passed, tally, breakdown });
      setGameState('bill-results');
  };

  const handlePerformAction = (action: ActionType, payload?: any) => {
      if (action === 'promoteParty' || action === 'addressLocal' || action === 'organizeStateRally' || action === 'strengthenLocalBranch' || action === 'undermineRival') {
          setCharacters(prev => prev.map(c => {
              if (c.id !== playerCharacterId) return c;
              let infGain = 0;
              let recGain = 0;
              switch(action) {
                  case 'promoteParty': infGain = 5; recGain = 2; break;
                  case 'addressLocal': infGain = 8; recGain = 4; break;
                  case 'strengthenLocalBranch': infGain = 5; recGain = 0; break;
                  case 'organizeStateRally': infGain = 10; recGain = 5; break;
              }
              return { ...c, influence: Math.min(100, c.influence + infGain), recognition: Math.min(100, c.recognition + recGain) };
          }));
          setActionScreenOpen(false);
          addToLog('Action Performed', `You performed: ${action}`, 'personal');
      } else if (action === 'secedeJoinParty') {
          if (!playerCharacter) return;
          setSecessionData({ affiliationId: playerCharacter.affiliationId, leaderId: playerCharacter.id, type: 'join' });
          setActionScreenOpen(false);
          setGameState('secession-join-party');
      } else if (action === 'secedeNewParty') {
          if (!playerCharacter) return;
          setSecessionData({ affiliationId: playerCharacter.affiliationId, leaderId: playerCharacter.id, type: 'new' });
          setActionScreenOpen(false);
          setGameState('secession-new-party');
      } else if (action === 'negotiatePartyMerger') {
          setActionScreenOpen(false);
          setMergerMode(payload?.mode || 'merge');
          setGameState('party-merger');
      } else if (action === 'inviteToParty') {
          setActionScreenOpen(false);
          setMergerMode(payload?.mode || 'absorb');
          setGameState('party-merger');
      } else if (action === 'createAlliance') {
          setActionScreenOpen(false);
          setGameState('alliance-creation');
      } else if (action === 'securityCrackdown') {
          if(government) {
              const { event, updatedCharacters, updatedParties } = performSecurityCrackdown(currentDate, characters, parties, government);
              if (observeMode) {
                  setCharacters(updatedCharacters);
                  setParties(updatedParties);
                  addToLog(event.title, event.description, 'event');
              } else {
                  setCharacters(updatedCharacters);
                  setParties(updatedParties);
                  setCurrentEvent(event);
                  setPreEventSpeed(playSpeed); 
                  setPlaySpeed(null); 
                  setGameState('event-modal');
              }
          }
          setActionScreenOpen(false);
      }
  };

  const handleSecessionConfirm = (options: { targetPartyId?: string; newPartyName?: string; newPartyEthnicityFocus?: Ethnicity | null }) => {
      if (!secessionData || !playerCharacter) return;
      
      const result = handleAffiliationSecession(
          parties,
          characters,
          electionResults,
          secessionData.affiliationId,
          playerCharacter,
          secessionData.type,
          options,
          currentDate,
          options.newPartyEthnicityFocus
      );
      
      setParties(result.newParties);
      setCharacters(result.updatedCharacters);
      setElectionResults(result.newElectionResults);
      
      setSecessionData(null);
      setGameState('game');
  };

  const handleMergerPropose = (targets: { parties: Party[], affiliations: Affiliation[] }, newName: string) => {
      if (!playerParty || !playerCharacter) return;
      
      const successChance = playerCharacter.influence > 60 ? 0.8 : 0.3;
      
      const acceptedParties = targets.parties.filter(() => Math.random() < successChance);
      const rejectedParties = targets.parties.filter(p => !acceptedParties.includes(p));
      
      const acceptedAffiliations = targets.affiliations.filter(() => Math.random() < successChance);
      const rejectedAffiliations = targets.affiliations.filter(a => !acceptedAffiliations.includes(a));
      
      if (acceptedParties.length === 0 && acceptedAffiliations.length === 0) {
          setMergerData({ initiatingPartyId: playerParty.id, results: { accepted: [], rejected: [...targets.parties, ...targets.affiliations], newName }});
          setGameState('party-merger-result');
          return;
      }
      
      if (mergerMode === 'merge') {
           const result = handlePartyMerger(
              parties,
              playerParty.id,
              acceptedParties,
              acceptedAffiliations,
              newName,
              playerCharacter.id,
              undefined, 
              electionResults,
              characters,
              currentDate
          );
          setParties(result.newParties);
          setCharacters(result.updatedCharacters);
          setElectionResults(result.newElectionResults);
      } else {
           const result = handlePartyAbsorption(
              parties,
              playerParty.id,
              acceptedParties,
              acceptedAffiliations,
              electionResults,
              characters,
              currentDate
           );
          setParties(result.newParties);
           setCharacters(result.updatedCharacters);
           setElectionResults(result.newElectionResults);
      }
      
      setMergerData({ 
          initiatingPartyId: playerParty.id, 
          results: { 
              accepted: [...acceptedParties, ...acceptedAffiliations], 
              rejected: [...rejectedParties, ...rejectedAffiliations], 
              newName 
          }
      });
      setGameState('party-merger-result');
  };

  const handleAlliancePropose = (name: string, invitedPartyIds: string[], type: AllianceType) => {
      if (!playerParty) return;
      const targetParties = parties.filter(p => invitedPartyIds.includes(p.id));
      const { alliance, rejectedIds } = attemptAllianceFormation(playerParty, targetParties, name, type, alliances);
      
      if (alliance) {
          setAlliances(prev => [...prev, alliance]);
          addToLog('Alliance Formed', `The "${alliance.name}" (${alliance.type}) has been successfully formed!`, 'politics');
      } else {
          addToLog('Alliance Failed', "Alliance formation failed. No parties accepted the invitation or constraints were violated.", 'politics');
      }
      setGameState('game');
  };


  return (
    <div className="h-screen w-screen overflow-hidden relative bg-gray-900">
      {gameState === 'start' && <StartScreen onStart={handleStartGame} onSpectate={handleSpectatorStart} />}
      
      {gameState === 'party-selection' && (
        <PartySelectionScreen 
          parties={parties} 
          onPartySelect={handlePartySelect} 
        />
      )}
      
      {gameState === 'character-selection' && selectedPartyId && (
        <CharacterSelectionScreen 
            onCharacterSelect={handleCharacterSelect}
            uniqueStates={uniqueStates}
            party={partiesMap.get(selectedPartyId)!}
            affiliationsMap={affiliationsMap}
        />
      )}

      {(gameState === 'game' || gameState === 'parliament' || gameState === 'election-results' || gameState === 'government-formation' || gameState === 'position-selection' || gameState === 'secession-join-party' || gameState === 'secession-new-party' || gameState === 'party-merger' || gameState === 'party-merger-result' || gameState === 'alliance-creation' || gameState === 'event-modal' || gameState === 'bill-selection' || gameState === 'bill-proposal' || gameState === 'bill-results') && (
          <>
            <MapComponent 
                features={features}
                characters={characters}
                demographicsMap={demographicsMap}
                parties={parties}
                selectedSeatCode={selectedSeatCode}
                onSeatClick={setSelectedSeatCode}
                affiliationToPartyMap={affiliationToPartyMap}
                electionResults={electionResults}
                isPlayerMoving={isPlayerMoving}
                onPositionSelect={(code) => {
                    if(isPlayerMoving && playerCharacter) {
                        setCharacters(prev => prev.map(c => c.id === playerCharacter.id ? { ...c, currentSeatCode: code } : c));
                        setIsPlayerMoving(false);
                    } else if (gameState === 'position-selection') {
                        handlePositionSelect(code);
                    }
                }}
                isPositionSelectionMode={gameState === 'position-selection'}
                affiliationsMap={affiliationsMap}
                strongholdMap={strongholdMap}
            />
            
            {gameState === 'position-selection' && (
                <div className="absolute top-20 left-0 w-full flex justify-center z-30 pointer-events-none">
                   <div className="bg-black/70 text-white px-6 py-3 rounded-full text-xl font-bold shadow-lg backdrop-blur-sm border border-white/20 pointer-events-auto animate-pulse">
                      Select your starting constituency
                   </div>
                </div>
            )}

            <div className="absolute top-0 left-0 w-full z-20 pointer-events-none">
                <div className="pointer-events-auto">
                    <GameControlPanel 
                        currentDate={currentDate}
                        currentSpeed={playSpeed}
                        onSpeedChange={setPlaySpeed}
                        onPlay={() => setPlaySpeed(2000)}
                        onPause={() => setPlaySpeed(null)}
                        nextElectionDate={nextElectionDate}
                        onShowParliament={() => setShowParliament(!showParliament)}
                        electionHappened={electionHistory.length > 0}
                        onOpenHistory={() => setShowElectionHistory(true)}
                        isElectionClose={isElectionClose}
                        onOpenParties={() => setShowPartyList(!showPartyList)}
                        observeMode={observeMode}
                        onToggleObserveMode={() => setObserveMode(!observeMode)}
                        onToggleLog={() => setShowEventLog(!showEventLog)}
                        unreadLogCount={unreadLogCount}
                        onOpenCountryInfo={() => setShowCountryInfo(!showCountryInfo)}
                    />
                </div>
            </div>

            {showEventLog && (
                <EventLogPanel 
                    logEntries={gameLog} 
                    onClose={() => setShowEventLog(false)}
                />
            )}
            
            {showCountryInfo && (
                <CountryInfoPanel 
                    demographicsMap={demographicsMap}
                    onClose={() => setShowCountryInfo(false)}
                />
            )}

            {selectedSeat && (
                <ConstituencyPanel 
                    seat={selectedSeat}
                    demographics={selectedSeatDemographics}
                    characters={characters}
                    affiliationsMap={affiliationsMap}
                    partiesMap={partiesMap}
                    onClose={() => setSelectedSeatCode(null)}
                    onCharacterClick={(char) => setSelectedCharacterId(char.id)}
                    affiliationToPartyMap={affiliationToPartyMap}
                    onPartyClick={(pid) => setViewingPartyId(pid)}
                    electionHistory={electionHistory}
                    strongholdMap={strongholdMap}
                />
            )}
            
            {viewingPartyId && partiesMap.get(viewingPartyId) && (
                <PartyPanel
                    party={partiesMap.get(viewingPartyId)!}
                    members={characters.filter(c => affiliationToPartyMap.get(c.affiliationId) === viewingPartyId)}
                    affiliationsMap={affiliationsMap}
                    featuresMap={featuresMap}
                    demographicsMap={demographicsMap}
                    onClose={() => setViewingPartyId(null)}
                    onCharacterClick={(char) => {
                        setViewingPartyId(null);
                        setSelectedCharacterId(char.id);
                    }}
                    strongholdMap={strongholdMap}
                />
            )}
            
            {showPartyList && (
                <PartyListPanel
                    parties={parties}
                    affiliationsMap={affiliationsMap}
                    onClose={() => setShowPartyList(false)}
                    onPartyClick={(pid) => {
                        setViewingPartyId(pid);
                    }}
                />
            )}
            
            {selectedCharacterId && (
                (() => {
                    const char = characters.find(c => c.id === selectedCharacterId);
                    if (!char) return null;
                    const aff = affiliationsMap.get(char.affiliationId);
                    const pId = affiliationToPartyMap.get(char.affiliationId);
                    const p = pId ? partiesMap.get(pId) : undefined;
                    return (
                        <CharacterInfoPanel 
                            character={char}
                            affiliation={aff}
                            party={p}
                            seat={featuresMap.get(char.currentSeatCode)}
                            onClose={() => setSelectedCharacterId(null)}
                            currentDate={currentDate}
                            roleInfo={char.isPlayer ? playerRoleInfo : { role: 'Member', details: 'NPC' }} 
                            isPlayerMoving={isPlayerMoving}
                            onInitiateMove={() => { setIsPlayerMoving(true); setSelectedCharacterId(null); setSelectedSeatCode(null); }}
                            onCancelMove={() => setIsPlayerMoving(false)}
                            onOpenPartyManagement={() => setPartyManagementOpen(true)}
                            onOpenActions={() => setActionScreenOpen(true)}
                            onOpenAffiliationManagement={() => {
                                if (!p) return;
                                const allocated = Array.from(p.contestedSeats.entries())
                                    .filter(([, data]) => data.allocatedAffiliationId === char.affiliationId)
                                    .map(([sCode]) => {
                                        const f = featuresMap.get(sCode);
                                        return f ? { seatCode: sCode, party: p, seatFeature: f } : null
                                    })
                                    .filter((x): x is { seatCode: string; party: Party; seatFeature: GeoJsonFeature } => x !== null);
                                setAffiliationManagementData({ affiliationId: char.affiliationId, allocatedSeats: allocated });
                            }}
                            isPartyManagementDisabled={!char.isPlayer || playerRoleInfo.role !== 'National Leader'}
                            partyManagementTooltip={
                                !char.isPlayer || playerRoleInfo.role !== 'National Leader' 
                                ? "Only the National Leader can manage the party." 
                                : "Manage party strategy and internal affairs."
                            }
                            isAffiliationManagementDisabled={!char.isPlayer || !char.isAffiliationLeader}
                            affiliationManagementTooltip={
                                !char.isPlayer || !char.isAffiliationLeader 
                                ? "Only the Faction Leader can manage the faction." 
                                : "Manage faction members and candidates."
                            }
                            government={government}
                        />
                    );
                })()
            )}

            {playerCharacter && !selectedCharacterId && (
                <PlayerCharacterButton player={playerCharacter} onClick={() => setSelectedCharacterId(playerCharacter.id)} />
            )}
            
            {partyManagementOpen && playerParty && (
                <PartyManagementScreen 
                    party={playerParty}
                    allParties={parties}
                    allSeatFeatures={features}
                    affiliationsMap={affiliationsMap}
                    featuresMap={featuresMap}
                    demographicsMap={demographicsMap}
                    characters={characters}
                    currentDate={currentDate}
                    onSave={(updatedParties) => {
                        setParties(prev => prev.map(p => {
                            const updated = updatedParties.find(up => up.id === p.id);
                            return updated || p;
                        }));
                        setHasPlayerManagedStrategy(true);
                        setPartyManagementOpen(false);
                    }}
                    onClose={() => setPartyManagementOpen(false)}
                    alliances={alliances}
                    strongholdMap={strongholdMap}
                />
            )}

            {actionScreenOpen && playerCharacter && (
                <CharacterActionScreen 
                    player={playerCharacter}
                    onClose={() => setActionScreenOpen(false)}
                    onPerformAction={handlePerformAction}
                    characters={characters}
                    partiesMap={partiesMap}
                    affiliationToPartyMap={affiliationToPartyMap}
                    roleInfo={playerRoleInfo}
                    isAffiliationLeader={!!playerCharacter.isAffiliationLeader}
                    daysUntilElection={daysUntilElection}
                    alliances={alliances}
                    government={government}
                />
            )}
            
            {affiliationManagementData && (
                <AffiliationManagementScreen 
                    affiliation={affiliationsMap.get(affiliationManagementData.affiliationId)!}
                    allocatedSeats={affiliationManagementData.allocatedSeats}
                    affiliationMembers={characters.filter(c => c.affiliationId === affiliationManagementData.affiliationId && c.isAlive)}
                    demographicsMap={demographicsMap}
                    affiliationsMap={affiliationsMap}
                    onConfirm={(pId, selections) => {
                        setParties(prev => prev.map(p => {
                            if (p.id !== pId) return p;
                            const newContested = new Map(p.contestedSeats);
                            selections.forEach((charId, seatCode) => {
                                const existing = newContested.get(seatCode);
                                if (existing) {
                                    newContested.set(seatCode, { ...existing, candidateId: charId });
                                }
                            });
                            return { ...p, contestedSeats: newContested };
                        }));
                        setHasPlayerManagedAffiliation(true);
                        setAffiliationManagementData(null);
                    }}
                    onCancel={() => setAffiliationManagementData(null)}
                    strongholdMap={strongholdMap}
                />
            )}

            {showParliament && (
                <div className="absolute left-0 top-20 h-[calc(100%-5rem)] z-30 animate-slideRight">
                    <ParliamentScreen 
                        gameState={gameState}
                        electionResults={electionResults}
                        partiesMap={partiesMap}
                        totalSeats={allSeatCodes.length}
                        speaker={speaker}
                        onClose={() => setShowParliament(false)}
                        currentBill={parliamentBill}
                        playerParty={playerParty}
                        billVoteResults={billVoteResults}
                        onVoteOnBill={(v) => handleBillVote(v)}
                        onCloseBillResults={() => {
                            setBillVoteResults(null);
                            setParliamentBill(null);
                            setGameState('game');
                        }}
                        government={government}
                        characters={characters}
                        onCallVoteOfConfidence={handleVoteOfConfidence}
                        onProposeBill={handleBillProposal}
                    />
                </div>
            )}

            {/* Bill Selection Screen */}
            {gameState === 'bill-selection' && (
                <BillSelectionScreen 
                    onSelect={handleBillSelect}
                    onCancel={() => {
                        setGameState('game');
                        setShowParliament(true);
                    }}
                />
            )}

            {/* Bill Proposal Panel (Global) */}
            {gameState === 'bill-proposal' && parliamentBill && playerParty && (
                <BillProposalPanel 
                    bill={parliamentBill}
                    playerParty={playerParty}
                    partiesMap={partiesMap}
                    electionResults={electionResults}
                    onVote={handleBillVote}
                />
            )}

            {/* Bill Results Panel (Global) */}
            {gameState === 'bill-results' && billVoteResults && parliamentBill && (
                <BillResultsPanel 
                    bill={parliamentBill}
                    results={billVoteResults}
                    partiesMap={partiesMap}
                    onClose={() => {
                        setBillVoteResults(null);
                        setParliamentBill(null);
                        setGameState('game');
                        setShowParliament(true);
                    }}
                />
            )}
            
            {showElectionHistory && (
                <ElectionHistoryScreen 
                    history={electionHistory}
                    partiesMap={partiesMap}
                    totalSeats={allSeatCodes.length}
                    onClose={() => setShowElectionHistory(false)}
                    electionHistory={electionHistory}
                />
            )}

            {gameState === 'secession-join-party' && secessionData && affiliationsMap.get(secessionData.affiliationId) && (
                <SecessionJoinPartyScreen 
                    parties={parties}
                    currentPartyId={affiliationToPartyMap.get(secessionData.affiliationId) || ''}
                    affiliation={affiliationsMap.get(secessionData.affiliationId)!}
                    onSelect={(targetPartyId) => handleSecessionConfirm({ targetPartyId })}
                    onCancel={() => { setSecessionData(null); setGameState('game'); }}
                />
            )}

            {gameState === 'secession-new-party' && secessionData && affiliationsMap.get(secessionData.affiliationId) && (
                <SecessionNewPartyScreen 
                    affiliation={affiliationsMap.get(secessionData.affiliationId)!}
                    onConfirm={(name, focus) => handleSecessionConfirm({ newPartyName: name, newPartyEthnicityFocus: focus })}
                    onCancel={() => { setSecessionData(null); setGameState('game'); }}
                />
            )}

            {gameState === 'party-merger' && playerParty && (
                <PartyMergerScreen 
                    playerParty={playerParty}
                    parties={parties}
                    affiliations={AFFILIATIONS}
                    characters={characters}
                    onPropose={handleMergerPropose}
                    onCancel={() => setGameState('game')}
                    mode={mergerMode}
                />
            )}
            
            {gameState === 'party-merger-result' && mergerData && mergerData.results && (
                <MergerResultModal 
                    result={mergerData.results}
                    onClose={() => { setMergerData(null); setGameState('game'); }}
                />
            )}

            {gameState === 'alliance-creation' && playerParty && (
                <AllianceCreationScreen 
                    playerParty={playerParty}
                    parties={parties}
                    alliances={alliances}
                    onConfirm={handleAlliancePropose}
                    onCancel={() => setGameState('game')}
                />
            )}

            {gameState === 'government-formation' && playerParty && (
                <GovernmentFormationScreen 
                    playerParty={playerParty}
                    parties={parties}
                    electionResults={electionResults}
                    totalSeats={allSeatCodes.length}
                    alliances={alliances}
                    onConfirm={(coalitionIds) => handleGovernmentFormation(coalitionIds)}
                    onAuto={() => handleGovernmentFormation()}
                />
            )}

             {gameState === 'event-modal' && currentEvent && (
                <EventModal 
                    event={currentEvent}
                    onAcknowledge={handleEventAcknowledge}
                />
            )}

          </>
      )}
      
      {gameState === 'election-results' && (
          <ElectionResultsPanel 
             results={electionResults}
             previousResults={electionHistory.length > 1 ? electionHistory[electionHistory.length - 2].results : new Map()}
             detailedResults={detailedElectionResults}
             previousDetailedResults={null}
             partiesMap={partiesMap}
             totalSeats={allSeatCodes.length}
             onClose={() => {
                 startGovernmentFormationFlow();
             }}
             electionDate={currentDate}
             totalElectorate={electionHistory[electionHistory.length-1]?.totalElectorate || 0}
             alliances={alliances}
          />
      )}
      
      {gameState === 'party-election-voting' && partyElectionData && (
          <PartyElectionScreen 
             party={partyElectionData.party}
             candidates={partyElectionData.candidates}
             affiliationsMap={affiliationsMap}
             onVote={handlePartyVote}
             isPlayerEligibleToVote={
                !!playerCharacter && (
                    // Check if Affiliation Leader
                    !!playerCharacter.isAffiliationLeader || 
                    // Check if State Leader/Executive in this party
                    (partyElectionData && partyElectionData.party.stateBranches.some(b => b.leaderId === playerCharacter.id || b.executiveIds.includes(playerCharacter.id)))
                )
             }
          />
      )}
      
      {gameState === 'party-election-results' && partyElectionData && partyElectionData.voteTally && partyElectionData.winnerId && (
          <PartyElectionResultsPanel 
              voteTally={partyElectionData.voteTally}
              winnerId={partyElectionData.winnerId}
              deputyWinnerId={partyElectionData.deputyWinnerId}
              party={partyElectionData.party}
              partyMembers={characters.filter(c => partyElectionData.party.affiliationIds.includes(c.affiliationId))}
              onClose={() => {
                  setPartyElectionData(null);
                  setGameState('game');
              }}
          />
      )}

      {gameState === 'speaker-election-voting' && speakerElectionData && (
          <SpeakerElectionScreen 
             candidates={speakerElectionData.candidates}
             onVote={handleSpeakerVote}
             partiesMap={partiesMap}
             electionResults={electionResults}
             playerPartyId={playerParty?.id || ''}
             isSpectator={!playerCharacterId}
          />
      )}
      
      {gameState === 'speaker-election-results' && speakerElectionData && speakerElectionData.results && (
          <SpeakerElectionResultsPanel 
            results={speakerElectionData.results}
            partiesMap={partiesMap}
            characters={characters}
            onClose={() => {
                setSpeakerElectionData(null);
                setGameState('game');
                setShowParliament(true); // Open parliament to show new setup
            }}
          />
      )}

    </div>
  );
};

export default App;

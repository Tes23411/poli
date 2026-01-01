import { Character, Party, StatePartyBranch, GeoJsonFeature, Demographics, PartyElectionVoteTally, ElectionResults, SpeakerVoteTally, SpeakerVoteBreakdown, Bill, VoteDirection, Affiliation, CharacterHistoryEntry, Ethnicity, Government, Minister, VoteOfConfidenceResult, PoliticalAlliance, AllianceType, Ideology, GameEvent, StrongholdMap } from '../types';
import { calculateEffectiveInfluence } from './influence';
import {generateAllianceName} from './naming';
import { COLOR_PALETTE } from '../constants';
import { AFFILIATIONS } from '../affiliations';

export const STATE_EXECUTIVE_COUNT = 3;

// --- Ideology Naming Logic ---

const IDEOLOGY_GRID = [
  // Row 0 (Eco 0-10) - Planned Economy
  ["Totalitarian Communism", "Maoism", "Juche", "Trotskyism", "Left Communism", "Communization", "Anarchist Communism", "Kropotkinism", "Post-Left Anarchism", "Anarcho-Primitivism"],
  // Row 1 (Eco 10-20)
  ["Stalinism", "Soviet Model", "Command Economy", "Central Planning", "Planned Economy", "Decentralized Planning", "Participatory Economics", "Anarcho-Communism", "Communitarian Anarchism", "Insurrectionary Anarchism"],
  // Row 2 (Eco 20-30)
  ["Marxism-Leninism", "Centralized Communism", "State Communism", "Planned Socialism", "Council Communism", "Federalist Communism", "Libertarian Marxism", "Anarcho-Syndicalism", "Anarcho-Collectivism", "Platform Anarchism"],
  // Row 3 (Eco 30-40)
  ["Leninist Socialism", "Fabian Socialism", "Guild Socialism", "Reformist Socialism", "Market Socialism", "Cooperative Socialism", "Communalism", "Syndicalism", "Left-Mutualism", "Collectivist Anarchism"],
  // Row 4 (Eco 40-50)
  ["Authoritarian Socialism", "State Socialism", "Social Corporatism", "Social Democracy", "Democratic Socialism", "Federalist Socialism", "Decentralized Social Democracy", "Libertarian Socialism", "Individualist Anarchism", "Egoist Anarchism"],
  // Row 5 (Eco 50-60) - Mixed/Center
  ["State Corporatism", "Third Way", "Keynesianism", "Progressive Capitalism", "Centrism", "Federalism", "Decentralized Centrism", "Georgism", "Mutualism", "Anarcho-Mutualism"],
  // Row 6 (Eco 60-70)
  ["Guided Democracy", "Corporatism", "Dirigisme", "Welfare Capitalism", "Mixed Economy", "Cooperative Federalism", "Social Liberalism", "Geolibertarianism", "Mutualism (Right)", "Agorism"],
  // Row 7 (Eco 70-80)
  ["Developmental State", "Asian Tiger Model", "Corporatist Capitalism", "Social Market Economy", "Liberal Democracy", "Federalist Liberalism", "Decentralized Democracy", "Libertarian Conservatism", "Market Anarchism", "Right-Anarchism"],
  // Row 8 (Eco 80-90)
  ["Authoritarian Neoliberalism", "Centralized Neoliberalism", "Neoliberalism", "Ordoliberalism", "Liberal Conservatism", "Classical Liberalism", "Decentralized Liberalism", "Right-Libertarianism", "Paleolibertarianism", "Voluntaryism"],
  // Row 9 (Eco 90-100) - Free Market
  ["State Capitalism", "Authoritarian Capitalism", "Technocratic Capitalism", "Guided Capitalism", "Regulated Capitalism", "Liberal Capitalism", "Decentralized Capitalism", "Libertarianism", "Minarchism", "Anarcho-Capitalism"]
];

export const getIdeologyName = (ideology: Ideology): string => {
    const ecoIndex = Math.min(9, Math.floor(ideology.economic / 10));
    const govIndex = Math.min(9, Math.floor((100 - ideology.governance) / 10));
    return IDEOLOGY_GRID[ecoIndex][govIndex] || "Centrism";
};

// --- Ideology Calculation Logic ---

export const calculateAverageIdeology = (items: Ideology[]): Ideology => {
    if (items.length === 0) return { economic: 50, governance: 50 };
    
    const total = items.reduce((acc, cur) => ({
        economic: acc.economic + cur.economic,
        governance: acc.governance + cur.governance
    }), { economic: 0, governance: 0 });
    
    return {
        economic: total.economic / items.length,
        governance: total.governance / items.length
    };
};

export const updateAffiliationIdeologies = (characters: Character[], affiliations: Affiliation[]): Affiliation[] => {
    return affiliations.map(aff => {
        const members = characters.filter(c => c.isAlive && c.affiliationId === aff.id);
        const memberIdeologies = members.map(m => m.ideology);
        const avgIdeology = calculateAverageIdeology(memberIdeologies);
        
        if (members.length === 0) {
             return { ...aff, ideology: aff.baseIdeology || { economic: 50, governance: 50 } };
        }
        return { ...aff, ideology: avgIdeology };
    });
};

export const updatePartyIdeologies = (parties: Party[], affiliations: Affiliation[]): Party[] => {
    const affMap = new Map(affiliations.map(a => [a.id, a]));
    
    return parties.map(p => {
        const partyAffs = p.affiliationIds.map(id => affMap.get(id)).filter((a): a is Affiliation => !!a && !!a.ideology);
        const affIdeologies = partyAffs.map(a => a.ideology!);
        const avgIdeology = calculateAverageIdeology(affIdeologies);
        return { ...p, ideology: avgIdeology };
    });
};

// --- Relations Logic ---

const calculateIdeologicalCompatibility = (a: Party, b: Party): number => {
    let score = 100;

    const distEco = a.ideology.economic - b.ideology.economic;
    const distGov = a.ideology.governance - b.ideology.governance;
    const distance = Math.sqrt(distEco * distEco + distGov * distGov);
    
    score -= (distance * 0.5);

    if (a.ethnicityFocus && b.ethnicityFocus) {
        if (a.ethnicityFocus !== b.ethnicityFocus) score -= 30;
    } else if ((a.ethnicityFocus && !b.ethnicityFocus) || (!a.ethnicityFocus && b.ethnicityFocus)) {
        score -= 15;
    }
    
    return Math.max(0, Math.min(100, score));
};

export const initializePartyRelations = (parties: Party[]): Party[] => {
    return parties.map(p1 => {
        const newRelations = new Map<string, number>();
        parties.forEach(p2 => {
            if (p1.id === p2.id) return;
            const score = calculateIdeologicalCompatibility(p1, p2);
            const variance = Math.floor(Math.random() * 10) - 5;
            newRelations.set(p2.id, Math.max(0, Math.min(100, score + variance)));
        });
        return { ...p1, relations: newRelations };
    });
};

// --- Alliance & Consolidation Logic ---

export const consolidateAllianceCohesion = (
    parties: Party[], 
    alliances: PoliticalAlliance[]
): Party[] => {
    let updatedParties = [...parties];
    const partiesMap = new Map(updatedParties.map(p => [p.id, p]));

    alliances.forEach(alliance => {
        const members = alliance.memberPartyIds.map(id => partiesMap.get(id)).filter(Boolean) as Party[];
        if (members.length < 2) return;

        // 1. Calculate Average Alliance Ideology
        const avgEco = members.reduce((sum, p) => sum + p.ideology.economic, 0) / members.length;
        const avgGov = members.reduce((sum, p) => sum + p.ideology.governance, 0) / members.length;

        // 2. Shift Members closer to average (Consolidation)
        members.forEach(member => {
            // Move 5% closer to the center
            const newEco = member.ideology.economic + (avgEco - member.ideology.economic) * 0.05;
            const newGov = member.ideology.governance + (avgGov - member.ideology.governance) * 0.05;
            
            member.ideology = { economic: newEco, governance: newGov };

            // 3. Improve relations with allies
            members.forEach(ally => {
                if (ally.id !== member.id) {
                    const currentRel = member.relations.get(ally.id) || 50;
                    member.relations.set(ally.id, Math.min(100, currentRel + 1));
                }
            });

            // 4. Decrease relations with outsiders (Polarization)
            updatedParties.forEach(outsider => {
                if (!alliance.memberPartyIds.includes(outsider.id)) {
                    const currentRel = member.relations.get(outsider.id) || 50;
                    member.relations.set(outsider.id, Math.max(0, currentRel - 0.5));
                }
            });
        });
    });

    return updatedParties;
};

export const attemptAllianceMerger = (
    alliances: PoliticalAlliance[],
    parties: Party[]
): { mergedParty: Party; dissolvedAllianceId: string; removedPartyIds: string[] } | null => {
    const partiesMap = new Map(parties.map(p => [p.id, p]));

    for (const alliance of alliances) {
        if (alliance.type !== 'Alliance') continue; // Only full alliances merge, not pacts
        
        const members = alliance.memberPartyIds.map(id => partiesMap.get(id)).filter(Boolean) as Party[];
        if (members.length < 2) continue;

        // Criteria 1: Ideological Unity (Deviation < 5)
        const avgEco = members.reduce((sum, p) => sum + p.ideology.economic, 0) / members.length;
        const avgGov = members.reduce((sum, p) => sum + p.ideology.governance, 0) / members.length;

        const isIdeologicallyUnified = members.every(p => {
            const dist = Math.sqrt(Math.pow(p.ideology.economic - avgEco, 2) + Math.pow(p.ideology.governance - avgGov, 2));
            return dist < 5.0; // Very tight threshold
        });

        if (!isIdeologicallyUnified) continue;

        // Criteria 2: Relational Unity (All pairs > 90)
        let isFriendly = true;
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const rel = members[i].relations.get(members[j].id) || 0;
                if (rel < 90) {
                    isFriendly = false;
                    break;
                }
            }
            if (!isFriendly) break;
        }

        if (isFriendly) {
            // MERGE!
            const leaderParty = partiesMap.get(alliance.leaderPartyId) || members[0];
            const allAffiliations = Array.from(new Set(members.flatMap(p => p.affiliationIds)));
            
            const mergedParty: Party = {
                id: `merged-${alliance.id}`,
                name: alliance.name, // Takes alliance name
                color: leaderParty.color,
                affiliationIds: allAffiliations,
                leaderId: leaderParty.leaderId,
                deputyLeaderId: members.find(p => p.id !== leaderParty.id)?.leaderId, // Second strongest leader becomes deputy
                stateBranches: [], // Reset branches, re-elect later
                contestedSeats: new Map(), // Reset, AI will reallocate
                leaderHistory: leaderParty.leaderHistory,
                ethnicityFocus: members.every(p => p.ethnicityFocus === members[0].ethnicityFocus) ? members[0].ethnicityFocus : undefined,
                relations: new Map(), // Re-init later
                unity: 100, // High unity at birth
                ideology: { economic: avgEco, governance: avgGov }
            };

            return {
                mergedParty,
                dissolvedAllianceId: alliance.id,
                removedPartyIds: members.map(p => p.id)
            };
        }
    }

    return null;
};

export const formBigTentCoalition = (
    parties: Party[],
    governmentParties: string[], // IDs
    leaderCharId: string | null
): { alliance: PoliticalAlliance, parties: Party[] } | null => {
    const oppositionParties = parties.filter(p => !governmentParties.includes(p.id));
    
    // Sort opposition by size/influence (using seats would be best, but unity/relations works for proxy)
    // Here we pick largest opposition to lead.
    if (oppositionParties.length <= 2) return null; // Need at least 2 to form a coalition

    // Simply take all opposition parties
    const memberIds = oppositionParties.map(p => p.id);
    const leaderParty = oppositionParties[0]; // Simplification

    const alliance: PoliticalAlliance = {
        id: `big-tent-${Date.now()}`,
        name: generateAllianceName(), // Generic Big Tent name
        memberPartyIds: memberIds,
        type: 'Alliance',
        leaderPartyId: leaderParty.id
    };

    // Boost relations immediately
    const updatedParties = parties.map(p => {
        if (memberIds.includes(p.id)) {
            const newRelations = new Map(p.relations);
            memberIds.forEach(allyId => {
                if (allyId !== p.id) newRelations.set(allyId, 90); // Forced unity
            });
            return { ...p, relations: newRelations, unity: Math.max(p.unity, 80) };
        }
        return p;
    });

    return { alliance, parties: updatedParties };
};

const getAllianceAcceptanceChance = (initiator: Party, target: Party, type: AllianceType): number => {
    const relation = initiator.relations.get(target.id) || 50;
    let chance = relation / 100;

    if (type === 'Alliance') {
        chance -= 0.2;
    } else {
        chance += 0.1;
    }
    return Math.max(0, Math.min(1, chance));
};

const getAllianceIdeology = (alliance: PoliticalAlliance, parties: Party[]): Ideology => {
    const members = parties.filter(p => alliance.memberPartyIds.includes(p.id));
    if (members.length === 0) return { economic: 50, governance: 50 };
    return calculateAverageIdeology(members.map(m => m.ideology));
};

export const attemptAllianceFormation = (
    initiatorParty: Party,
    targetParties: Party[],
    allianceName: string,
    type: AllianceType,
    existingAlliances: PoliticalAlliance[],
    context?: {
        allParties: Party[],
        allSeatCodes: string[],
        featuresMap: Map<string, GeoJsonFeature>,
        demographicsMap: Map<string, Demographics>,
        affiliationsMap: Map<string, Affiliation>,
        characters: Character[],
        strongholdMap: StrongholdMap
    }
): { alliance: PoliticalAlliance | null, updatedParties: Party[], rejectedIds: string[] } => {
    
    // 1. Determine base alliance (New or Existing/Expansion)
    let activeAlliance: PoliticalAlliance | null = existingAlliances.find(a => a.memberPartyIds.includes(initiatorParty.id)) || null;
    let baseIdeology = initiatorParty.ideology;
    let allianceMembers: Party[] = [initiatorParty];

    if (activeAlliance && context) {
         // Expanding existing alliance
         allianceMembers = context.allParties.filter(p => activeAlliance!.memberPartyIds.includes(p.id));
         baseIdeology = getAllianceIdeology(activeAlliance, context.allParties);
    } else if (activeAlliance) {
         // Fallback if context missing
         baseIdeology = initiatorParty.ideology; 
    }

    const acceptedParties: Party[] = [];
    const rejectedIds: string[] = [];

    // 2. Evaluate Targets
    for (const target of targetParties) {
        // Skip if target is already in THIS alliance
        if (activeAlliance && activeAlliance.memberPartyIds.includes(target.id)) continue;
        
        // Skip if target is in ANOTHER alliance
        if (existingAlliances.some(a => a.memberPartyIds.includes(target.id) && a.id !== activeAlliance?.id)) {
            rejectedIds.push(target.id);
            continue;
        }

        // --- Ideology Check (Main Factor) ---
        const dist = Math.sqrt(
            Math.pow(target.ideology.economic - baseIdeology.economic, 2) + 
            Math.pow(target.ideology.governance - baseIdeology.governance, 2)
        );

        // Strict threshold: Ideological distance > 35 is rejected
        let ideologyChance = Math.max(0, 1 - (dist / 35)); 
        
        // --- Relation Check ---
        let avgRel = 0;
        allianceMembers.forEach(m => {
            avgRel += (m.relations.get(target.id) || 50);
        });
        avgRel /= allianceMembers.length;
        
        const relationChance = avgRel / 100;

        // Combined Chance: 70% Ideology, 30% Relations
        const finalChance = (ideologyChance * 0.7) + (relationChance * 0.3);
        
        // Bonus for "Pact" vs "Alliance"
        const modifier = type === 'Pact' ? 0.1 : 0;

        if (Math.random() < (finalChance + modifier) && finalChance > 0.3) {
            acceptedParties.push(target);
        } else {
            rejectedIds.push(target.id);
        }
    }

    if (acceptedParties.length === 0) {
        return { alliance: activeAlliance, updatedParties: [], rejectedIds: targetParties.map(p => p.id) };
    }

    // 3. Form or Update Alliance
    let finalAlliance: PoliticalAlliance;
    
    if (activeAlliance) {
        finalAlliance = {
            ...activeAlliance,
            memberPartyIds: [...activeAlliance.memberPartyIds, ...acceptedParties.map(p => p.id)]
        };
        console.log(`Alliance Expanded: ${finalAlliance.name} added ${acceptedParties.map(p=>p.name).join(', ')}`);
    } else {
        finalAlliance = {
            id: `alliance-${Date.now()}`,
            name: allianceName,
            memberPartyIds: [initiatorParty.id, ...acceptedParties.map(p => p.id)],
            type: type,
            leaderPartyId: initiatorParty.id
        };
        console.log(`New Alliance Formed: ${finalAlliance.name} with ${finalAlliance.memberPartyIds.length} members`);
    }

    // 4. Redistribute Seats (Re-attempt by AI)
    let updatedParties: Party[] = [];
    
    if (context) {
        const allMemberParties = [...allianceMembers, ...acceptedParties];
        // Ensure uniqueness and get full Party objects
        const uniqueMembers = Array.from(new Set(allMemberParties.map(p => p.id)))
            .map(id => allMemberParties.find(p => p.id === id)!);

        updatedParties = distributeAllianceSeats(
            finalAlliance,
            uniqueMembers,
            context.allSeatCodes,
            context.demographicsMap,
            context.featuresMap,
            context.affiliationsMap,
            context.characters,
            context.strongholdMap
        );
    }

    return { alliance: finalAlliance, updatedParties, rejectedIds };
};

export const getCoalitionAcceptanceChance = (initiator: Party, target: Party, existingCoalitionMembers: Party[]): number => {
    let baseScore = initiator.relations.get(target.id) || 50;
    
    // Check relations with existing members too
    for(const member of existingCoalitionMembers) {
        const rel = member.relations.get(target.id) || 50;
        baseScore = (baseScore + rel) / 2;
    }

    let chance = baseScore / 100;
    
    // Bonus if ideologies are close
    const distEco = Math.abs(initiator.ideology.economic - target.ideology.economic);
    if (distEco < 20) chance += 0.1;

    return Math.max(0, Math.min(1, chance));
};


// --- Seat Allocation Helpers ---

const calculatePartySeatScore = (
    party: Party,
    seatCode: string,
    featuresMap: Map<string, GeoJsonFeature>,
    demographicsMap: Map<string, Demographics>,
    affiliationsMap: Map<string, Affiliation>,
    characters: Character[],
    affiliationToPartyMap: Map<string, string>,
    strongholdMap: StrongholdMap
): number => {
    const feature = featuresMap.get(seatCode);
    if (!feature) return 0;
    const demographics = demographicsMap.get(seatCode);

    let score = 0;

    const charactersInSeat = characters.filter(c => c.currentSeatCode === seatCode && c.isAlive);
    charactersInSeat.forEach(char => {
        const pId = affiliationToPartyMap.get(char.affiliationId);
        if (pId === party.id) {
            const influence = calculateEffectiveInfluence(char, feature, demographics || null, affiliationsMap, strongholdMap, char.id, char.affiliationId);
            score += influence;
        }
    });

    const incumbentMP = characters.find(c => c.isMP && c.currentSeatCode === seatCode);
    if (incumbentMP) {
        const incPartyId = affiliationToPartyMap.get(incumbentMP.affiliationId);
        if (incPartyId === party.id) {
            score += 50; 
        }
    }

    if (demographics) {
        let ethnicScore = 0;
        if (party.ethnicityFocus) {
            const key = `${party.ethnicityFocus.toLowerCase()}Percent` as keyof Demographics;
            const percent = (demographics[key] as number) || 0;
            ethnicScore = percent;
        } else {
            ethnicScore = 35;
        }
        score += ethnicScore;
    } else {
        score += 20;
    }

    return score;
};

const determineBestAffiliationForSeat = (
    party: Party,
    seatCode: string,
    featuresMap: Map<string, GeoJsonFeature>,
    demographicsMap: Map<string, Demographics>,
    affiliationsMap: Map<string, Affiliation>,
    partyMembers: Character[],
    strongholdMap: StrongholdMap
): string | null => {
    const seatFeature = featuresMap.get(seatCode);
    const demographics = demographicsMap.get(seatCode);
    
    if (!seatFeature) return null;

    let bestAffiliationId: string | null = null;
    let maxInf = -1;

    for (const affId of party.affiliationIds) {
        const membersOfAff = partyMembers.filter(c => c.affiliationId === affId);
        if (membersOfAff.length === 0) continue;
        
        const topCandidate = membersOfAff.reduce((prev, current) => 
           (prev.influence + prev.charisma) > (current.influence + current.charisma) ? prev : current
        );

        const inf = calculateEffectiveInfluence(topCandidate, seatFeature, demographics || null, affiliationsMap, strongholdMap, topCandidate.id, affId);
        if (inf > maxInf) {
            maxInf = inf;
            bestAffiliationId = affId;
        }
    }
    
    if (!bestAffiliationId && party.affiliationIds.length > 0) {
        bestAffiliationId = party.affiliationIds[0];
    }

    return bestAffiliationId;
};

// --- Seat Allocation Logic ---

export const distributeAllianceSeats = (
    alliance: PoliticalAlliance,
    memberParties: Party[],
    allSeatCodes: string[],
    demographicsMap: Map<string, Demographics>,
    featuresMap: Map<string, GeoJsonFeature>,
    affiliationsMap: Map<string, Affiliation>,
    characters: Character[],
    strongholdMap: StrongholdMap
): Party[] => {
    const updatedParties = memberParties.map(p => ({ 
        ...p, 
        contestedSeats: new Map(p.contestedSeats) 
    }));
    const partyMap = new Map(updatedParties.map(p => [p.id, p]));

    updatedParties.forEach(p => p.contestedSeats.clear());

    const affToPartyId = new Map<string, string>();
    updatedParties.forEach(p => p.affiliationIds.forEach(aid => affToPartyId.set(aid, p.id)));

    const seatPartyScores = new Map<string, Map<string, number>>();

    allSeatCodes.forEach(seatCode => {
        const scores = new Map<string, number>();
        updatedParties.forEach(p => {
            const score = calculatePartySeatScore(
                p, 
                seatCode, 
                featuresMap, 
                demographicsMap, 
                affiliationsMap, 
                characters, 
                affToPartyId,
                strongholdMap
            );
            scores.set(p.id, score);
        });
        seatPartyScores.set(seatCode, scores);
    });

    const allocations = new Map<string, string>();
    
    allSeatCodes.forEach(seatCode => {
        const scores = seatPartyScores.get(seatCode);
        if (!scores) return;

        let winnerId = updatedParties[0].id;
        let maxScore = -1;

        const shuffledParties = [...updatedParties].sort(() => Math.random() - 0.5);

        shuffledParties.forEach(p => {
            const s = scores.get(p.id) || 0;
            if (s > maxScore) {
                maxScore = s;
                winnerId = p.id;
            }
        });

        allocations.set(seatCode, winnerId);
    });

    if (allSeatCodes.length >= updatedParties.length * 2) {
        let rebalancingNeeded = true;
        let safetyLoop = 0;

        while (rebalancingNeeded && safetyLoop < 20) {
            rebalancingNeeded = false;
            safetyLoop++;

            const seatCounts = new Map<string, number>();
            updatedParties.forEach(p => seatCounts.set(p.id, 0));
            allocations.forEach(pId => seatCounts.set(pId, (seatCounts.get(pId) || 0) + 1));

            const deficitParties = updatedParties.filter(p => (seatCounts.get(p.id) || 0) < 2);

            if (deficitParties.length > 0) {
                rebalancingNeeded = true;
                const surplusParties = updatedParties
                    .filter(p => (seatCounts.get(p.id) || 0) > 2)
                    .sort((a, b) => (seatCounts.get(b.id) || 0) - (seatCounts.get(a.id) || 0));
                
                if (surplusParties.length === 0) break;

                const donor = surplusParties[0];
                const receiver = deficitParties[0];

                let bestSeatToSwap: string | null = null;
                let bestReceiverScore = -1;

                for (const [seatCode, ownerId] of allocations.entries()) {
                    if (ownerId === donor.id) {
                        const scores = seatPartyScores.get(seatCode);
                        const receiverScore = scores ? (scores.get(receiver.id) || 0) : 0;
                        
                        if (receiverScore > bestReceiverScore) {
                            bestReceiverScore = receiverScore;
                            bestSeatToSwap = seatCode;
                        }
                    }
                }

                if (bestSeatToSwap) {
                    allocations.set(bestSeatToSwap, receiver.id);
                } else {
                    for (const [seatCode, ownerId] of allocations.entries()) {
                         if (ownerId === donor.id) {
                             allocations.set(seatCode, receiver.id);
                             break;
                         }
                    }
                }
            }
        }
    }

    allocations.forEach((partyId, seatCode) => {
        const party = partyMap.get(partyId);
        if (party) {
             const partyMembers = characters.filter(c => party.affiliationIds.includes(c.affiliationId) && c.isAlive);
             const bestAffiliationId = determineBestAffiliationForSeat(
                 party,
                 seatCode,
                 featuresMap,
                 demographicsMap,
                 affiliationsMap,
                 partyMembers,
                 strongholdMap
             );

             party.contestedSeats.set(seatCode, { allocatedAffiliationId: bestAffiliationId, candidateId: null });
        }
    });

    return updatedParties;
};

export const electStateLeadersAndExecutives = (party: Party, allCharacters: Character[], uniqueStates: string[]): { updatedParty: Party; roleChanges: { charId: string, event: string }[] } => {
  const updatedParty = { ...party };
  const partyMembers = allCharacters.filter(c => party.affiliationIds.includes(c.affiliationId) && c.isAlive);
  const roleChanges: { charId: string, event: string }[] = [];
  
  const oldBranchLeaders = new Map<string, string | undefined>();
  party.stateBranches.forEach(b => oldBranchLeaders.set(b.state, b.leaderId));
  const oldExecutives = new Set(party.stateBranches.flatMap(b => b.executiveIds));

  updatedParty.stateBranches = uniqueStates.map(state => {
    const membersInState = partyMembers.filter(m => m.state === state);
    membersInState.sort((a, b) => b.influence - a.influence);

    const newLeaderId = membersInState.length > 0 ? membersInState[0].id : undefined;
    const newExecutiveIds = membersInState.slice(1, 1 + STATE_EXECUTIVE_COUNT).map(m => m.id);

    const oldLeaderId = oldBranchLeaders.get(state);
    if (newLeaderId && newLeaderId !== oldLeaderId) {
        roleChanges.push({ charId: newLeaderId, event: `Elected State Leader for ${party.name} in ${state}.` });
    }
    newExecutiveIds.forEach(execId => {
        if (!oldExecutives.has(execId)) {
            roleChanges.push({ charId: execId, event: `Appointed State Executive for ${party.name} in ${state}.` });
        }
    });

    return {
      state,
      leaderId: newLeaderId,
      executiveIds: newExecutiveIds,
    };
  });

  return { updatedParty, roleChanges };
};

export const conductPartyLeadershipElection = (voters: Character[], candidates: Character[]): { leaderId?: string; deputyLeaderId?: string; voteTally: PartyElectionVoteTally } => {
    const voteTally: PartyElectionVoteTally = new Map();
    
    candidates.forEach(candidate => voteTally.set(candidate.id, 0));

    if (voters.length === 0 && candidates.length > 0) {
        const sortedByInfluence = [...candidates].sort((a, b) => b.influence - a.influence);
        const leaderId = sortedByInfluence.length > 0 ? sortedByInfluence[0].id : undefined;
        const deputyLeaderId = sortedByInfluence.length > 1 ? sortedByInfluence[1].id : undefined;
        if (leaderId) {
            voteTally.set(leaderId, 1);
        }
        return { leaderId, deputyLeaderId, voteTally };
    }

    for (const voter of voters) {
        let bestCandidateId: string | null = null;
        let maxScore = -1;

        for (const candidate of candidates) {
            let score = candidate.influence + candidate.charisma;
            if (voter.affiliationId === candidate.affiliationId) {
                score *= 1.5;
            }
            score += candidate.recognition / 2;
            
            const distEco = Math.abs(voter.ideology.economic - candidate.ideology.economic);
            const distGov = Math.abs(voter.ideology.governance - candidate.ideology.governance);
            score += (200 - (distEco + distGov)) * 0.2;

            score *= (1 + Math.random() * 0.1);

            if (score > maxScore) {
                maxScore = score;
                bestCandidateId = candidate.id;
            }
        }

        if (bestCandidateId) {
            const currentVotes = voteTally.get(bestCandidateId) || 0;
            voteTally.set(bestCandidateId, currentVotes + 1);
        }
    }
    
    const sortedVotes = Array.from(voteTally.entries()).sort((a, b) => b[1] - a[1]);

    let leaderId: string | undefined = undefined;
    let deputyLeaderId: string | undefined = undefined;
    
    if (sortedVotes.length === 0 || sortedVotes.every(v => v[1] === 0)) {
        const sortedByInfluence = [...candidates].sort((a, b) => b.influence - a.influence);
        leaderId = sortedByInfluence.length > 0 ? sortedByInfluence[0].id : undefined;
        deputyLeaderId = sortedByInfluence.length > 1 ? sortedByInfluence[1].id : undefined;
    } else {
        leaderId = sortedVotes.length > 0 ? sortedVotes[0][0] : undefined;
        deputyLeaderId = sortedVotes.length > 1 ? sortedVotes[1][0] : undefined;
    }

    if (leaderId && leaderId === deputyLeaderId) {
      deputyLeaderId = undefined;
    }
    
    return { leaderId, deputyLeaderId, voteTally };
};

export const aiManagePartyContests = (
    party: Party,
    allCharacters: Character[],
    allSeatCodes: string[],
    featuresMap: Map<string, GeoJsonFeature>,
    demographicsMap: Map<string, Demographics>,
    affiliationsMap: Map<string, Affiliation>,
    strongholdMap: StrongholdMap
): Party => {
    const newContestedSeats = new Map<string, { allocatedAffiliationId: string | null; candidateId: string | null; }>();
    const partyMembers = allCharacters.filter(c => party.affiliationIds.includes(c.affiliationId) && c.isAlive);
    
    const affToPartyId = new Map<string, string>();
    party.affiliationIds.forEach(aid => affToPartyId.set(aid, party.id));

    allSeatCodes.forEach(seatCode => {
        const existingContest = party.contestedSeats.get(seatCode);
        
        const score = calculatePartySeatScore(
            party, 
            seatCode, 
            featuresMap, 
            demographicsMap, 
            affiliationsMap, 
            allCharacters, 
            affToPartyId,
            strongholdMap
        );

        if (score > 15 || existingContest) {
             const bestAffiliationId = determineBestAffiliationForSeat(
                 party,
                 seatCode,
                 featuresMap,
                 demographicsMap,
                 affiliationsMap,
                 partyMembers,
                 strongholdMap
             );

             // FIX: Validate existing candidate
             let validCandidateId = existingContest?.candidateId || null;
             if (validCandidateId) {
                 const candidate = allCharacters.find(c => c.id === validCandidateId);
                 // If candidate is dead or no longer in this party (affiliation mismatch), remove them
                 if (!candidate || !candidate.isAlive || !party.affiliationIds.includes(candidate.affiliationId)) {
                     validCandidateId = null;
                 }
             }

             newContestedSeats.set(seatCode, { 
                allocatedAffiliationId: bestAffiliationId, 
                candidateId: validCandidateId 
            });
        }
    });

    return { ...party, contestedSeats: newContestedSeats };
};

export const aiSelectAffiliationCandidates = (
  affiliationMembers: Character[],
  allocatedSeats: { seatCode: string; party: Party; seatFeature: GeoJsonFeature }[],
  demographicsMap: Map<string, Demographics>,
  affiliationsMap: Map<string, Affiliation>,
  strongholdMap: StrongholdMap
): Map<string, string> => {
    const selections = new Map<string, string>();
    let availableMembers = [...affiliationMembers];

    for (const { seatCode, seatFeature } of allocatedSeats) {
        let bestCandidate: { id: string; influence: number } | null = null;

        for (const member of availableMembers) {
            const demographics = demographicsMap.get(seatCode) || null;
            let influence = calculateEffectiveInfluence(member, seatFeature, demographics, affiliationsMap, strongholdMap, member.id, member.affiliationId);
            
            if (member.isMP && member.currentSeatCode === seatCode) {
                influence *= 1.5;
            }
            if (member.currentSeatCode === seatCode) {
                influence *= 1.2;
            }

            if (bestCandidate === null || influence > bestCandidate.influence) {
                bestCandidate = { id: member.id, influence: influence };
            }
        }

        if (bestCandidate) {
            selections.set(seatCode, bestCandidate.id);
            availableMembers = availableMembers.filter(m => m.id !== bestCandidate!.id);
        }
    }
    return selections;
};

export const aiFullElectionStrategy = (
    party: Party,
    allCharacters: Character[],
    allSeatCodes: string[],
    featuresMap: Map<string, GeoJsonFeature>,
    demographicsMap: Map<string, Demographics>,
    affiliationsMap: Map<string, Affiliation>,
    currentDate: Date,
    strongholdMap: StrongholdMap,
    skipStrategy: boolean = false,
    skipAffiliationIds: string[] = []
): { updatedParty: Party, historyUpdates: { charId: string, entry: CharacterHistoryEntry }[] } => {
    let partyWithAffiliationFocus = party;
    if (!skipStrategy) {
        partyWithAffiliationFocus = aiManagePartyContests(party, allCharacters, allSeatCodes, featuresMap, demographicsMap, affiliationsMap, strongholdMap);
    }

    const historyUpdates: { charId: string, entry: CharacterHistoryEntry }[] = [];
    const newContestedSeats = new Map(partyWithAffiliationFocus.contestedSeats);

    const partyAffiliations = party.affiliationIds.map(id => affiliationsMap.get(id)).filter((aff): aff is Affiliation => !!aff);

    for (const affiliation of partyAffiliations) {
        if (skipAffiliationIds.includes(affiliation.id)) continue;
        
        const allocatedSeatsForAffiliation = Array.from(partyWithAffiliationFocus.contestedSeats.entries())
            .filter(([, data]) => data.allocatedAffiliationId === affiliation.id)
            .map(([seatCode]) => {
                const seatFeature = featuresMap.get(seatCode);
                return seatFeature ? { seatCode, party: partyWithAffiliationFocus, seatFeature } : null;
            })
            .filter((s): s is { seatCode: string; party: Party; seatFeature: GeoJsonFeature } => s !== null);

        if (allocatedSeatsForAffiliation.length > 0) {
            const affiliationMembers = allCharacters.filter(c => c.affiliationId === affiliation.id && c.isAlive);
            
            if (affiliationMembers.length > 0) {
                const selections = aiSelectAffiliationCandidates(
                    affiliationMembers,
                    allocatedSeatsForAffiliation,
                    demographicsMap,
                    affiliationsMap,
                    strongholdMap
                );

                for (const [seatCode, candidateId] of selections.entries()) {
                    const currentData = newContestedSeats.get(seatCode);
                    if (currentData) {
                        newContestedSeats.set(seatCode, { ...currentData, candidateId });
                        
                        if (party.contestedSeats.get(seatCode)?.candidateId !== candidateId) {
                            const seatName = featuresMap.get(seatCode)?.properties.PARLIMEN || 'a constituency';
                            historyUpdates.push({
                                charId: candidateId,
                                entry: {
                                    date: currentDate,
                                    event: `Selected as candidate for ${seatName}.`
                                }
                            });
                        }
                    }
                }
            }
        }
    }
    // Fallback Pass: Fill empty seats with any party member
    const seatsNeedsCandidates = Array.from(newContestedSeats.entries())
        .filter(([, data]) => !data.candidateId);

    if (seatsNeedsCandidates.length > 0) {
        const allPartyMembers = allCharacters.filter(c => party.affiliationIds.includes(c.affiliationId) && c.isAlive);
        const assignedIds = new Set(Array.from(newContestedSeats.values()).map(d => d.candidateId).filter(Boolean));
        const availableBackups = allPartyMembers.filter(c => !assignedIds.has(c.id)).sort((a, b) => b.influence - a.influence);

        for (const [seatCode, data] of seatsNeedsCandidates) {
            if (availableBackups.length === 0) break;
            const backupCandidate = availableBackups.shift();
            if (backupCandidate) {
                 newContestedSeats.set(seatCode, { ...data, candidateId: backupCandidate.id });
                 const seatName = featuresMap.get(seatCode)?.properties.PARLIMEN || 'a constituency';
                 historyUpdates.push({
                    charId: backupCandidate.id,
                    entry: { date: currentDate, event: `Drafted as emergency candidate for ${seatName}.` }
                });
            }
        }
    }

    const updatedParty = { ...partyWithAffiliationFocus, contestedSeats: newContestedSeats };
    return { updatedParty, historyUpdates };
};

export const getPartySeatCounts = (electionResults: ElectionResults, partiesMap: Map<string, Party>): Map<string, number> => {
    const partySeatCounts = new Map<string, number>();
    partiesMap.forEach(p => partySeatCounts.set(p.id, 0));
    for (const partyId of electionResults.values()) {
        partySeatCounts.set(partyId, (partySeatCounts.get(partyId) || 0) + 1);
    }
    return partySeatCounts;
};

const totalSeats = (seatCounts: Map<string, number>): number => {
    let total = 0;
    for (const count of seatCounts.values()) {
        total += count;
    }
    return total;
};

export const determineSpeakerCandidates = (electionResults: ElectionResults, parties: Party[], characters: Character[]): Character[] => {
    const partiesMap = new Map(parties.map(p => [p.id, p]));
    const seatCounts = getPartySeatCounts(electionResults, partiesMap);
    
    const sortedParties = [...seatCounts.entries()].sort((a,b) => b[1] - a[1]);

    const candidates: Character[] = [];

    if (sortedParties.length > 0) {
        const govParty = partiesMap.get(sortedParties[0][0]);
        if (govParty?.leaderId) {
            const candidate = characters.find(c => c.id === govParty.leaderId && c.isAlive);
            if (candidate) candidates.push(candidate);
        }
    }
    
    if (sortedParties.length > 1) {
        const oppParty = partiesMap.get(sortedParties[1][0]);
        if (oppParty?.leaderId && !candidates.some(c => c.id === oppParty.leaderId)) {
            const candidate = characters.find(c => c.id === oppParty.leaderId && c.isAlive);
            if (candidate) candidates.push(candidate);
        }
    }
    
    if(candidates.length < 2 && characters.length > 1) {
        const otherChars = characters
            .filter(c => c.isAlive && !candidates.some(cand => cand.id === c.id))
            .sort((a,b) => (b.influence + b.recognition) - (a.influence + a.recognition));
        
        while(candidates.length < 2 && otherChars.length > 0) {
            candidates.push(otherChars.shift()!);
        }
    }

    return candidates;
};

export const conductSpeakerVote = (
    electionResults: ElectionResults,
    parties: Party[],
    candidates: Character[],
    affiliationToPartyMap: Map<string, string>,
    playerPartyId: string,
    playerVoteId: string 
): { winnerId: string; tally: SpeakerVoteTally; breakdown: SpeakerVoteBreakdown } => {
    const partiesMap = new Map(parties.map(p => [p.id, p]));
    const seatCounts = getPartySeatCounts(electionResults, partiesMap);
    
    const voteTally: SpeakerVoteTally = new Map();
    const voteBreakdown: SpeakerVoteBreakdown = new Map<string, string>(); 
    
    candidates.forEach(c => voteTally.set(c.id, 0));

    if (candidates.length === 0) return { winnerId: '', tally: new Map(), breakdown: new Map() };
    if (candidates.length === 1) return { winnerId: candidates[0].id, tally: new Map([[candidates[0].id, totalSeats(seatCounts)]]), breakdown: new Map() };
    
    const govCandidate = candidates[0];
    const oppCandidate = candidates.length > 1 ? candidates[1] : candidates[0];
    const govPartyId = affiliationToPartyMap.get(govCandidate.affiliationId);
    
    const alliancePartyIds = ['umno', 'mca', 'mic'];

    for (const [partyId, seats] of seatCounts.entries()) {
        if (seats === 0) continue;

        let voteGoesToId: string;

        if (partyId === playerPartyId) {
            voteGoesToId = playerVoteId;
        } else {
            const isAllianceMember = alliancePartyIds.includes(partyId);
            const isGovPartyAlliance = alliancePartyIds.includes(govPartyId!);
            
            if (isGovPartyAlliance && isAllianceMember) {
                voteGoesToId = govCandidate.id;
            } else {
                voteGoesToId = oppCandidate.id;
            }
        }
        
        voteTally.set(voteGoesToId, (voteTally.get(voteGoesToId) || 0) + seats);
        voteBreakdown.set(partyId, voteGoesToId);
    }
    
    const sortedVotes = Array.from(voteTally.entries()).sort((a, b) => b[1] - a[1]);
    const winnerId = sortedVotes.length > 0 ? sortedVotes[0][0] : candidates[0].id;
    
    return { winnerId, tally: voteTally, breakdown: voteBreakdown };
};

export const aiDecideBillVote = (party: Party | undefined, bill: Bill): VoteDirection => {
    if (!party) return 'Abstain';
    const alliancePartyIds = ['umno', 'mca', 'mic'];
    const isProposingPartyInAlliance = alliancePartyIds.includes(bill.proposingPartyId);
    const isVotingPartyInAlliance = alliancePartyIds.includes(party.id);

    // Constitutional Bill Logic - Requires 2/3, stakes are higher.
    if (bill.isConstitutional) {
         // If proposed by ally, strict discipline
         if (isProposingPartyInAlliance && isVotingPartyInAlliance) return 'Aye';
         // If proposed by ally, strict discipline
         if (isProposingPartyInAlliance && isVotingPartyInAlliance) return 'Aye';
         // If proposed by rival, strict opposition unless it benefits us
         if (!isProposingPartyInAlliance && isVotingPartyInAlliance) return 'Nay';
         if (isProposingPartyInAlliance && !isVotingPartyInAlliance) return 'Nay';

         // For independent interactions or special cases, check effects
         for (const effect of bill.effects) {
            if (effect.type === 'party_influence' && effect.targetId === party.id) {
                if (effect.value > 0) return 'Aye';
                if (effect.value < 0) return 'Nay';
            }
         }
    }

    if (isProposingPartyInAlliance && isVotingPartyInAlliance) {
        return Math.random() > 0.1 ? 'Aye' : 'Abstain'; 
    }
    
    for (const effect of bill.effects) {
        if (effect.type === 'party_influence' && effect.targetId === party.id) {
            return effect.value > 0 ? 'Aye' : 'Nay'; 
        }
    }
    
    if (bill.tags.includes('economic')) {
        if (party.ideology.economic > 60) return 'Aye';
        if (party.ideology.economic < 40) return 'Nay';
    }

    if (bill.tags.includes('religious') && party.affiliationIds.some(id => id.includes('islamist'))) {
        return 'Aye';
    }
     if (bill.tags.includes('nationalist') && party.affiliationIds.some(id => id.includes('nat'))) {
        return 'Aye';
    }
     if (bill.tags.includes('social') && party.affiliationIds.some(id => id.includes('chinese') || id.includes('indian'))) {
        return Math.random() > 0.3 ? 'Aye' : 'Abstain';
    }
    
    if (isProposingPartyInAlliance && !isVotingPartyInAlliance) {
        return Math.random() > 0.2 ? 'Nay' : 'Abstain';
    }

    return 'Abstain';
};


export const updateAffiliationLeaders = (characters: Character[], affiliations: Affiliation[]): Character[] => {
    const affiliationLeaders = new Set<string>();

    for (const affiliation of affiliations) {
        const members = characters.filter(c => c.isAlive && c.affiliationId === affiliation.id);
        if (members.length > 0) {
            const leader = members.sort((a, b) => b.influence - a.influence)[0];
            affiliationLeaders.add(leader.id);
        }
    }

    return characters.map(c => ({
        ...c, isAffiliationLeader: affiliationLeaders.has(c.id)
    }));
};

export const handleAffiliationSecession = (
    currentParties: Party[],
    currentCharacters: Character[],
    currentElectionResults: ElectionResults,
    affiliationId: string,
    leader: Character,
    type: 'join' | 'new',
    options: { targetPartyId?: string; newPartyName?: string },
    date: Date,
    newPartyEthnicityFocus?: Ethnicity | null
): { newParties: Party[]; newElectionResults: ElectionResults; updatedCharacters: Character[] } => {
    let newParties = [...currentParties];
    const newElectionResults = new Map(currentElectionResults);
    
    const sourcePartyIndex = newParties.findIndex(p => p.affiliationIds.includes(affiliationId));
    let sourcePartyName = 'Independent';

    if (sourcePartyIndex !== -1) {
        const sourceParty = { ...newParties[sourcePartyIndex] };
        sourcePartyName = sourceParty.name;
        
        sourceParty.affiliationIds = sourceParty.affiliationIds.filter(id => id !== affiliationId);

        if (sourceParty.affiliationIds.length === 0) {
            newParties.splice(sourcePartyIndex, 1);
        } else {
            if (sourceParty.leaderId === leader.id) {
                const remainingMembers = currentCharacters.filter(c => sourceParty.affiliationIds.includes(c.affiliationId) && c.isAlive);
                remainingMembers.sort((a,b) => b.influence - a.influence);
                sourceParty.leaderId = remainingMembers[0]?.id;
                sourceParty.deputyLeaderId = remainingMembers[1]?.id;
            }
            newParties[sourcePartyIndex] = sourceParty;
        }
    }

    let targetPartyName = '';
    
    if (type === 'join' && options.targetPartyId) {
        const targetPartyIndex = newParties.findIndex(p => p.id === options.targetPartyId);
        if (targetPartyIndex !== -1) {
            const targetParty = { ...newParties[targetPartyIndex] };
            targetParty.affiliationIds.push(affiliationId);
            newParties[targetPartyIndex] = targetParty;
            targetPartyName = targetParty.name;

            if (sourcePartyIndex !== -1) {
                currentElectionResults.forEach((winningPartyId, seatCode) => {
                    if (winningPartyId === currentParties[sourcePartyIndex].id) {
                        const mp = currentCharacters.find(c => c.currentSeatCode === seatCode && c.isMP);
                        if (mp && mp.affiliationId === affiliationId) {
                            newElectionResults.set(seatCode, targetParty.id);
                        }
                    }
                });
            }
        }
    } else if (type === 'new' && options.newPartyName) {
        const newParty: Party = {
            id: `party-${Date.now()}`,
            name: options.newPartyName,
            color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
            affiliationIds: [affiliationId],
            leaderId: leader.id,
            stateBranches: [],
            contestedSeats: new Map(),
            leaderHistory: [{ leaderId: leader.id, name: leader.name, startDate: date }],
            ethnicityFocus: newPartyEthnicityFocus === null ? undefined : (newPartyEthnicityFocus || null),
            relations: new Map(),
            unity: 100,
            ideology: leader.ideology
        };
        newParties.push(newParty);
        targetPartyName = newParty.name;

        if (sourcePartyIndex !== -1) {
            currentElectionResults.forEach((winningPartyId, seatCode) => {
                if (winningPartyId === currentParties[sourcePartyIndex].id) {
                    const mp = currentCharacters.find(c => c.currentSeatCode === seatCode && c.isMP);
                     if (mp && mp.affiliationId === affiliationId) {
                        newElectionResults.set(seatCode, newParty.id);
                    }
                }
            });
        }
    }
    
    const updatedCharacters = currentCharacters.map(c => {
        if (c.affiliationId === affiliationId) {
            const event = sourcePartyIndex !== -1 
                ? `Left ${sourcePartyName} to join ${targetPartyName}.`
                : `Joined ${targetPartyName} as an affiliated faction.`;
            const newHistory = [...c.history, { date, event }];
            return { ...c, history: newHistory };
        }
        return c;
    });

    newParties = initializePartyRelations(newParties);

    return { newParties, newElectionResults, updatedCharacters };
};

export const handlePartyAbsorption = (
    currentParties: Party[],
    hostPartyId: string,
    acceptedParties: Party[],
    acceptedAffiliations: Affiliation[],
    currentElectionResults: ElectionResults,
    currentCharacters: Character[],
    date: Date
): { newParties: Party[]; newElectionResults: ElectionResults; updatedCharacters: Character[] } => {
    
    const hostPartyIndex = currentParties.findIndex(p => p.id === hostPartyId);
    if (hostPartyIndex === -1) return { newParties: currentParties, newElectionResults: currentElectionResults, updatedCharacters: currentCharacters };
    
    const hostParty = { ...currentParties[hostPartyIndex] };
    const hostPartyName = hostParty.name;

    const absorbedPartyIds = new Set(acceptedParties.map(p => p.id));
    const absorbedAffiliationIds = new Set([
        ...acceptedParties.flatMap(p => p.affiliationIds),
        ...acceptedAffiliations.map(a => a.id)
    ]);
    
    absorbedAffiliationIds.forEach(id => {
        if (!hostParty.affiliationIds.includes(id)) {
            hostParty.affiliationIds.push(id);
        }
    });

    let remainingParties = currentParties.filter(p => p.id !== hostPartyId && !absorbedPartyIds.has(p.id));

    const poachedAffiliationIds = new Set(acceptedAffiliations.map(a => a.id));
    remainingParties = remainingParties.map(p => {
        const updatedAffiliations = p.affiliationIds.filter(affId => !poachedAffiliationIds.has(affId));
        if (updatedAffiliations.length < p.affiliationIds.length) {
             return { ...p, affiliationIds: updatedAffiliations };
        }
        return p;
    }).filter(p => p.affiliationIds.length > 0);

    let newParties = [...remainingParties, hostParty];

    const newElectionResults = new Map(currentElectionResults);
    
    // Transfer seats from absorbed parties to host party
    absorbedPartyIds.forEach(id => {
        for (const [seatCode, partyId] of newElectionResults.entries()) {
             if (partyId === id) {
                 newElectionResults.set(seatCode, hostParty.id);
             }
        }
    });

    const updatedCharacters = currentCharacters.map(c => {
         // Logic to add history
         const oldParty = currentParties.find(p => p.affiliationIds.includes(c.affiliationId));
         
         // If character's affiliation was poached or their party was absorbed
         if (poachedAffiliationIds.has(c.affiliationId) || (oldParty && absorbedPartyIds.has(oldParty.id))) {
             return { ...c, history: [...c.history, { date, event: `Absorbed into ${hostPartyName}.` }] };
         }
         return c;
    });

    return { newParties, newElectionResults, updatedCharacters };
};

export const handlePartyMerger = (
    currentParties: Party[],
    initiatorPartyId: string,
    acceptedParties: Party[],
    acceptedAffiliations: Affiliation[],
    newName: string,
    leaderId: string,
    deputyId: string | undefined,
    currentElectionResults: ElectionResults,
    currentCharacters: Character[],
    date: Date
): { newParties: Party[]; newElectionResults: ElectionResults; updatedCharacters: Character[] } => {
    
    const participatingPartyIds = new Set([initiatorPartyId, ...acceptedParties.map(p => p.id)]);
    const participatingAffiliations = new Set([
        ...currentParties.filter(p => participatingPartyIds.has(p.id)).flatMap(p => p.affiliationIds),
        ...acceptedAffiliations.map(a => a.id)
    ]);
    
    const newParty: Party = {
        id: `party-${Date.now()}-merged`,
        name: newName,
        color: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
        affiliationIds: Array.from(participatingAffiliations),
        leaderId: leaderId,
        deputyLeaderId: deputyId,
        stateBranches: [],
        contestedSeats: new Map(),
        leaderHistory: [{ leaderId: leaderId, name: currentCharacters.find(c => c.id === leaderId)?.name || 'Leader', startDate: date }],
        ethnicityFocus: undefined, // Mergers usually result in broader coalitions or new focus, let's default to multi-ethnic for now or inherit from initiator if strict.
        relations: new Map(),
        unity: 100,
        ideology: { economic: 50, governance: 50 } // Simplified average, ideally calc from affiliations
    };
    
    // Remove participating parties and strip poached affiliations from others
    let remainingParties = currentParties.filter(p => !participatingPartyIds.has(p.id));
    const poachedAffiliationIds = new Set(acceptedAffiliations.map(a => a.id));
    
    remainingParties = remainingParties.map(p => {
        const updatedAffiliations = p.affiliationIds.filter(affId => !poachedAffiliationIds.has(affId));
        if (updatedAffiliations.length < p.affiliationIds.length) {
             return { ...p, affiliationIds: updatedAffiliations };
        }
        return p;
    }).filter(p => p.affiliationIds.length > 0);
    
    const newParties = [...remainingParties, newParty];
    newParty.ideology = calculateAverageIdeology(
        newParty.affiliationIds
            .map(id => AFFILIATIONS.find(a => a.id === id)?.ideology)
            .filter((i): i is Ideology => !!i)
    );

    const newElectionResults = new Map(currentElectionResults);
    participatingPartyIds.forEach(id => {
        for (const [seatCode, partyId] of newElectionResults.entries()) {
             if (partyId === id) {
                 newElectionResults.set(seatCode, newParty.id);
             }
        }
    });

    const updatedCharacters = currentCharacters.map(c => {
        const oldParty = currentParties.find(p => p.affiliationIds.includes(c.affiliationId));
        if (participatingAffiliations.has(c.affiliationId)) {
             return { ...c, history: [...c.history, { date, event: `Merged into ${newName}.` }] };
        }
        return c;
    });

    return { newParties: initializePartyRelations(newParties), newElectionResults, updatedCharacters };
};


export const formGovernment = (
    electionResults: ElectionResults,
    parties: Party[],
    characters: Character[],
    date: Date,
    alliances: PoliticalAlliance[],
    forcedCoalitionIds?: string[]
): { government: Government; updatedCharacters: Character[] } => {
    
    const seatCounts = getPartySeatCounts(electionResults, new Map(parties.map(p => [p.id, p])));
    const total = Array.from(seatCounts.values()).reduce((a,b) => a+b, 0);
    const majority = Math.floor(total / 2) + 1;
    
    let rulingCoalitionIds: string[] = [];
    
    if (forcedCoalitionIds) {
        rulingCoalitionIds = forcedCoalitionIds;
    } else {
        // AI Logic to determine winner
        // 1. Check pre-existing alliances
        let bestAlliance: PoliticalAlliance | null = null;
        let maxSeats = -1;
        
        for (const alliance of alliances) {
            let seats = 0;
            alliance.memberPartyIds.forEach(pid => seats += (seatCounts.get(pid) || 0));
            if (seats > maxSeats) {
                maxSeats = seats;
                bestAlliance = alliance;
            }
        }
        
        // 2. Check single parties not in alliances
        let bestParty: Party | null = null;
        let maxPartySeats = -1;
        parties.forEach(p => {
             if (!alliances.some(a => a.memberPartyIds.includes(p.id))) {
                 const s = seatCounts.get(p.id) || 0;
                 if (s > maxPartySeats) {
                     maxPartySeats = s;
                     bestParty = p;
                 }
             }
        });

        if (bestAlliance && maxSeats >= maxPartySeats) {
            rulingCoalitionIds = bestAlliance.memberPartyIds;
        } else if (bestParty) {
            rulingCoalitionIds = [bestParty.id];
        } else if (parties.length > 0) {
            rulingCoalitionIds = [parties[0].id]; // Fallback
        }
    }
    
    // Sort coalition members by seat count to determine leader
    rulingCoalitionIds.sort((a,b) => (seatCounts.get(b) || 0) - (seatCounts.get(a) || 0));
    const leadPartyId = rulingCoalitionIds[0];
    const leadParty = parties.find(p => p.id === leadPartyId);
    
    const chiefMinisterId = leadParty?.leaderId || characters.find(c => c.isMP && c.affiliationId === leadParty?.affiliationIds[0])?.id || '';
    
    // Assign Cabinet
    const cabinet: Minister[] = [];
    const portfolios = ['Home Affairs', 'Finance', 'Defence', 'Education', 'Health', 'Agriculture', 'Transport'];
    
    // Distribute portfolios among coalition partners proportional to seats
    const totalCoalitionSeats = rulingCoalitionIds.reduce((sum, id) => sum + (seatCounts.get(id) || 0), 0);
    
    const eligibleMPs = characters.filter(c => c.isMP && rulingCoalitionIds.includes(parties.find(p => p.affiliationIds.includes(c.affiliationId))?.id || '') && c.id !== chiefMinisterId);
    // Sort by influence
    eligibleMPs.sort((a,b) => b.influence - a.influence);
    
    portfolios.forEach(portfolio => {
        if (eligibleMPs.length > 0) {
            const minister = eligibleMPs.shift()!;
            cabinet.push({ ministerId: minister.id, portfolio });
        }
    });

    const government: Government = {
        chiefMinisterId,
        rulingCoalitionIds,
        cabinet,
        formedDate: date
    };

    const updatedCharacters = characters.map(c => {
        if (c.id === chiefMinisterId) {
             return { ...c, history: [...c.history, { date, event: 'Appointed as Chief Minister.' }] };
        }
        const cab = cabinet.find(m => m.ministerId === c.id);
        if (cab) {
             return { ...c, history: [...c.history, { date, event: `Appointed as Minister of ${cab.portfolio}.` }] };
        }
        return c;
    });

    return { government, updatedCharacters };
};

export const conductVoteOfConfidence = (
    government: Government,
    characters: Character[],
    parties: Party[],
    electionResults: ElectionResults
): VoteOfConfidenceResult => {
    const votesBreakdown = new Map<string, 'For' | 'Against' | 'Abstain'>();
    let votesFor = 0;
    let votesAgainst = 0;
    
    const mps = characters.filter(c => c.isMP && c.isAlive);
    const partiesMap = new Map(parties.map(p => [p.id, p]));
    const affToParty = new Map<string, string>();
    parties.forEach(p => p.affiliationIds.forEach(aid => affToParty.set(aid, p.id)));

    mps.forEach(mp => {
        if (mp.currentSeatCode === 'SPEAKER') return; // Speaker doesn't vote usually

        const partyId = affToParty.get(mp.affiliationId);
        let vote: 'For' | 'Against' | 'Abstain' = 'Abstain';

        if (partyId && government.rulingCoalitionIds.includes(partyId)) {
            vote = 'For';
        } else {
            // Opposition logic
            // If relations with lead party are high, might abstain or vote for?
            // For now, strict opposition.
            vote = 'Against';
        }

        if (vote === 'For') votesFor++;
        if (vote === 'Against') votesAgainst++;
        votesBreakdown.set(mp.id, vote);
    });

    return {
        passed: votesFor > votesAgainst,
        votesFor,
        votesAgainst,
        breakdown: votesBreakdown
    };
};

export const performSecurityCrackdown = (
    date: Date,
    characters: Character[],
    parties: Party[],
    government: Government
): { event: GameEvent, updatedCharacters: Character[], updatedParties: Party[] } => {
    const updatedCharacters = [...characters];
    let updatedParties = [...parties];

    const oppMPs = characters.filter(c => {
         if (!c.isMP || c.currentSeatCode === 'SPEAKER') return false;
         const pId = parties.find(p => p.affiliationIds.includes(c.affiliationId))?.id;
         return pId && !government.rulingCoalitionIds.includes(pId);
    }).sort((a,b) => b.influence - a.influence);

    const target = oppMPs[0]; // Top opposition leader
    let eventDescription = "The government has initiated a security crackdown.";
    let eventEffects: string[] = [];

    if (target) {
         eventDescription = `Opposition leader ${target.name} has been detained under the Internal Security Act, citing threats to national stability.`;
         eventEffects = [`${target.name} removed from active politics.`, "Opposition anger rises.", "Government unity penalty."];
         
         const charIndex = updatedCharacters.findIndex(c => c.id === target.id);
         if (charIndex !== -1) {
             updatedCharacters[charIndex] = {
                 ...updatedCharacters[charIndex],
                 influence: 0,
                 history: [...updatedCharacters[charIndex].history, { date, event: "Detained under Internal Security Act." }]
             };
         }
    }

    const event: GameEvent = {
        id: `evt-crackdown-${Date.now()}`,
        title: "Internal Security Crackdown",
        description: eventDescription,
        date: date,
        type: 'crackdown_backlash',
        affectedPartyIds: government.rulingCoalitionIds,
        effects: eventEffects
    };

    return { event, updatedCharacters, updatedParties };
};

export const handleCharacterIdeologicalDrift = (
    characters: Character[],
    affiliationsMap: Map<string, Affiliation>,
    date: Date
): { updatedCharacters: Character[], driftLogs: string[] } => {
    const updatedCharacters: Character[] = [];
    const driftLogs: string[] = [];

    characters.forEach(c => {
        let char = { ...c };
        // Small chance to drift
        if (Math.random() < 0.01) { 
            const driftEco = (Math.random() * 4) - 2;
            const driftGov = (Math.random() * 4) - 2;
            
            char.ideology = {
                economic: Math.max(0, Math.min(100, char.ideology.economic + driftEco)),
                governance: Math.max(0, Math.min(100, char.ideology.governance + driftGov))
            };
        }
        updatedCharacters.push(char);
    });

    return { updatedCharacters, driftLogs };
};

export const cleanupPoliticalVacancies = (
    parties: Party[], 
    livingCharIds: Set<string>, // Changed from Character[]
    currentDate: Date
): Party[] => {
    return parties.map(p => {
        let updatedParty = { ...p };
        let historyUpdated = false;
        let newHistory = [...p.leaderHistory];
        
        // Check National Leader
        if (p.leaderId && !livingCharIds.has(p.leaderId)) {
            // Leader died or left
            if (newHistory.length > 0) {
                const lastEntry = newHistory[newHistory.length - 1];
                if (!lastEntry.endDate) {
                    newHistory[newHistory.length - 1] = { ...lastEntry, endDate: currentDate };
                    historyUpdated = true;
                }
            }
            updatedParty.leaderId = undefined; // Force election next cycle
        }
        
        if (historyUpdated) {
            updatedParty.leaderHistory = newHistory;
        }

        // Check Deputy
        if (p.deputyLeaderId && !livingCharIds.has(p.deputyLeaderId)) {
             updatedParty.deputyLeaderId = undefined;
        }

        // Check State Branches
        updatedParty.stateBranches = p.stateBranches.map(b => ({
            ...b,
            leaderId: (b.leaderId && livingCharIds.has(b.leaderId)) ? b.leaderId : undefined,
            executiveIds: b.executiveIds.filter(eid => livingCharIds.has(eid))
        }));

        return updatedParty;
    });
};

export const cleanupGovernmentVacancies = (
    government: Government | null,
    livingCharIds: Set<string> // Changed from Character[]
): Government | null => {
    if (!government) return null;

    // Check Cabinet
    const updatedCabinet = government.cabinet.filter(m => livingCharIds.has(m.ministerId));
    
    // If CM dead, the gov effectively falls or needs reshuffle. For now, leave empty string or handle upstream.
    const cmAlive = livingCharIds.has(government.chiefMinisterId);
    
    if (!cmAlive) {
        // Just remove from post. Election cycle logic or vote of confidence should trigger.
        return { ...government, chiefMinisterId: '', cabinet: updatedCabinet };
    }

    return { ...government, cabinet: updatedCabinet };
};
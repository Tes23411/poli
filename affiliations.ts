
import { COLOR_PALETTE } from './constants';
import { Ethnicity, Party, Affiliation, PoliticalAlliance } from './types';

// Economic: 0 (Planned) - 100 (Market)
// Governance: 0 (Decentralized) - 100 (Centralized)

export const AFFILIATIONS: Affiliation[] = [
    // Malay Affiliations
    { id: 'malay-nat', name: 'Malay Nationalist', ethnicity: 'Malay', area: 'Rural', baseIdeology: { economic: 40, governance: 80 } },
    { id: 'malay-prog', name: 'Malay Progressive', ethnicity: 'Malay', area: 'Both', baseIdeology: { economic: 60, governance: 40 } },
    { id: 'malay-islamist', name: 'Islamist', ethnicity: 'Malay', area: 'Rural', baseIdeology: { economic: 30, governance: 90 } },
    { id: 'malay-socialist', name: 'Malay Socialist', ethnicity: 'Malay', area: 'Both', baseIdeology: { economic: 20, governance: 70 } },
    { id: 'malay-royalist', name: 'Malay Royalist', ethnicity: 'Malay', area: 'Both', baseIdeology: { economic: 50, governance: 85 } },
    { id: 'malay-civil', name: 'Malay Civil Service', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 50, governance: 90 } },
    { id: 'malay-biz', name: 'Malay Industrialist', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 85, governance: 60 } },
    { id: 'malay-edu', name: 'Malay Teachers', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 35, governance: 50 } },
    { id: 'malay-labour', name: 'Malay Trade Unionist', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 15, governance: 40 } },
    { id: 'malay-intel', name: 'Malay Intellectual', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 40, governance: 40 } },
    { id: 'malay-merchant', name: 'Malay Merchant Guild', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 80, governance: 50 } },
    { id: 'malay-professional', name: 'Malay Professionals', ethnicity: 'Malay', area: 'Urban', baseIdeology: { economic: 65, governance: 50 } },
    { id: 'malay-farmer', name: 'Malay Farmers Association', ethnicity: 'Malay', area: 'Rural', baseIdeology: { economic: 30, governance: 60 } },
    { id: 'malay-youth', name: 'Malay Youth Movement', ethnicity: 'Malay', area: 'Both', baseIdeology: { economic: 45, governance: 45 } },
    { id: 'malay-religious', name: 'Religious Scholars', ethnicity: 'Malay', area: 'Rural', baseIdeology: { economic: 25, governance: 95 } },
    { id: 'malay-veteran', name: 'Malay Veterans', ethnicity: 'Malay', area: 'Both', baseIdeology: { economic: 40, governance: 90 } },
    
    // Chinese Affiliations
    { id: 'chinese-biz', name: 'Chinese Industrialist', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 95, governance: 60 } },
    { id: 'chinese-edu', name: 'Chinese Teachers', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 40, governance: 40 } },
    { id: 'chinese-labour', name: 'Chinese Trade Unionist', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 10, governance: 30 } },
    { id: 'chinese-intel', name: 'Chinese Intellectual', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 45, governance: 35 } },
    { id: 'chinese-merchant', name: 'Chinese Merchant Guild', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 90, governance: 50 } },
    { id: 'chinese-youth', name: 'Chinese Youth Wing', ethnicity: 'Chinese', area: 'Both', baseIdeology: { economic: 60, governance: 40 } },
    { id: 'chinese-professional', name: 'Chinese Professionals', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 75, governance: 50 } },
    { id: 'chinese-chamber', name: 'Chinese Chamber of Commerce', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 90, governance: 70 } },
    { id: 'chinese-clan', name: 'Chinese Clan Associations', ethnicity: 'Chinese', area: 'Both', baseIdeology: { economic: 70, governance: 80 } },
    { id: 'chinese-rural', name: 'Chinese Rural Community', ethnicity: 'Chinese', area: 'Rural', baseIdeology: { economic: 50, governance: 60 } },
    { id: 'chinese-progressive', name: 'Chinese Progressives', ethnicity: 'Chinese', area: 'Urban', baseIdeology: { economic: 55, governance: 30 } },
    
    // Indian Affiliations
    { id: 'indian-trad', name: 'Indian Traditionalist', ethnicity: 'Indian', area: 'Rural', baseIdeology: { economic: 40, governance: 75 } },
    { id: 'indian-reform', name: 'Indian Reformist', ethnicity: 'Indian', area: 'Both', baseIdeology: { economic: 50, governance: 35 } },
    { id: 'indian-prog', name: 'Indian Progressive', ethnicity: 'Indian', area: 'Urban', baseIdeology: { economic: 55, governance: 30 } },
    { id: 'indian-estate', name: 'Estate Workers Union', ethnicity: 'Indian', area: 'Rural', baseIdeology: { economic: 15, governance: 40 } },
    { id: 'indian-professional', name: 'Indian Professionals', ethnicity: 'Indian', area: 'Urban', baseIdeology: { economic: 65, governance: 50 } },
    { id: 'indian-merchant', name: 'Indian Merchants', ethnicity: 'Indian', area: 'Urban', baseIdeology: { economic: 85, governance: 50 } },
    { id: 'indian-youth', name: 'Indian Youth League', ethnicity: 'Indian', area: 'Both', baseIdeology: { economic: 45, governance: 40 } },
    { id: 'indian-labour', name: 'Indian Labour Movement', ethnicity: 'Indian', area: 'Urban', baseIdeology: { economic: 10, governance: 35 } },

// North Bornean Natives (Sabah) - 14 Affiliations
    { id: 'nb-chiefs', name: 'North Bornean Native Chiefs', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 60, governance: 85 } },
    { id: 'nb-coastal', name: 'Coastal Muslim Natives', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 40, governance: 75 } },
    { id: 'nb-interior', name: 'Interior Tribal Leaders', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 30, governance: 60 } },
    { id: 'nb-mission', name: 'Sabah Mission Alumni', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 55, governance: 45 } },
    { id: 'nb-planters', name: 'Native Smallholders (Sabah)', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 50, governance: 65 } },
    { id: 'nb-civil', name: 'North Bornean Civil Service', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 60, governance: 70 } },
    { id: 'nb-youth', name: 'Sabah Native Youth', ethnicity: 'North Bornean natives', area: 'Both', baseIdeology: { economic: 45, governance: 50 } },
    { id: 'nb-teachers', name: 'Native Teachers Union', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 40, governance: 40 } },
    { id: 'nb-women', name: 'Native Women\'s Council', ethnicity: 'North Bornean natives', area: 'Both', baseIdeology: { economic: 50, governance: 60 } },
    { id: 'nb-tamu', name: 'Tamu Traders Association', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 70, governance: 50 } },
    { id: 'nb-east-coast', name: 'East Coast Fishermen', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 30, governance: 60 } },
    { id: 'nb-cultural', name: 'Native Cultural Vanguard', ethnicity: 'North Bornean natives', area: 'Both', baseIdeology: { economic: 45, governance: 80 } },
    { id: 'nb-force', name: 'Native Constabulary', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 50, governance: 90 } },
    { id: 'nb-logging', name: 'Timber Camp Workers', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 20, governance: 40 } },
    { id: 'nb-railway', name: 'North Borneo Railway Union', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 25, governance: 45 } },
    { id: 'nb-estates', name: 'Native Estate Overseers', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 45, governance: 70 } },
    { id: 'nb-urban-traders', name: 'Urban Native Traders', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 80, governance: 55 } },
    { id: 'nb-christian', name: 'Native Christian Union', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 40, governance: 65 } },
    { id: 'nb-islamic', name: 'Native Islamic League', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 35, governance: 80 } },
    { id: 'nb-crafts', name: 'Native Arts & Crafts Guild', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 55, governance: 60 } },
    { id: 'nb-padi', name: 'West Coast Padi Farmers', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 35, governance: 55 } },
    { id: 'nb-clerks', name: 'Native Interpreters & Clerks', ethnicity: 'North Bornean natives', area: 'Urban', baseIdeology: { economic: 50, governance: 65 } },
    { id: 'nb-health', name: 'Native Health Workers', ethnicity: 'North Bornean natives', area: 'Both', baseIdeology: { economic: 45, governance: 50 } },
    { id: 'nb-scouts', name: 'Native Scout Leaders', ethnicity: 'North Bornean natives', area: 'Both', baseIdeology: { economic: 50, governance: 75 } },
    { id: 'nb-veterans', name: 'Native Ex-Services Association', ethnicity: 'North Bornean natives', area: 'Both', baseIdeology: { economic: 40, governance: 85 } },
    { id: 'nb-gatherers', name: 'Interior Produce Gatherers', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 25, governance: 50 } },
    { id: 'nb-boatmen', name: 'Native Boatmen Association', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 40, governance: 60 } },
    { id: 'nb-adat', name: 'Native Customary Law Advocates', ethnicity: 'North Bornean natives', area: 'Rural', baseIdeology: { economic: 45, governance: 90 } },

    // Sarawak Natives - 14 Affiliations
    { id: 'swk-longhouse', name: 'Longhouse Chiefs (Tuai Rumah)', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 35, governance: 80 } },
    { id: 'swk-melanau', name: 'Melanau Aristocracy', ethnicity: 'Sarawak natives', area: 'Both', baseIdeology: { economic: 65, governance: 85 } },
    { id: 'swk-upriver', name: 'Orang Ulu Aristocracy', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 40, governance: 90 } },
    { id: 'swk-mission', name: 'Sarawak Mission Alumni', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 50, governance: 40 } },
    { id: 'swk-rangers', name: 'Sarawak Rangers Veterans', ethnicity: 'Sarawak natives', area: 'Both', baseIdeology: { economic: 45, governance: 75 } },
    { id: 'swk-officers', name: 'Native Officers Service', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 55, governance: 70 } },
    { id: 'swk-dayak-coop', name: 'Dayak Cooperatives', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 40, governance: 50 } },
    { id: 'swk-oil', name: 'Native Oil Workers', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 15, governance: 40 } },
    { id: 'swk-land', name: 'Native Land Rights Bureau', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 30, governance: 30 } },
    { id: 'swk-teachers', name: 'Native Teachers Association', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 40, governance: 45 } },
    { id: 'swk-women', name: 'Sarakup Indu (Women\'s Guild)', ethnicity: 'Sarawak natives', area: 'Both', baseIdeology: { economic: 50, governance: 60 } },
    { id: 'swk-coastal', name: 'Coastal Fishermen', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 35, governance: 65 } },
    { id: 'swk-youth', name: 'Dayak Youth League', ethnicity: 'Sarawak natives', area: 'Both', baseIdeology: { economic: 45, governance: 35 } },
    { id: 'swk-penghulu', name: 'Council of Penghulus', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 40, governance: 85 } },
    { id: 'swk-pepper', name: 'Pepper Planters Association', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 60, governance: 60 } },
    { id: 'swk-rubber', name: 'Rubber Gardeners Union', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 45, governance: 55 } },
    { id: 'swk-river', name: 'Rejang River Boatmen', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 35, governance: 50 } },
    { id: 'swk-police', name: 'Native Constabulary', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 50, governance: 90 } },
    { id: 'swk-hill-farmers', name: 'Bidayuh Hill Farmers', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 30, governance: 70 } },
    { id: 'swk-church', name: 'Native Church Elders', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 40, governance: 80 } },
    { id: 'swk-labor', name: 'Urban Dayak Laborers', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 20, governance: 35 } },
    { id: 'swk-medical', name: 'Native Medical Dressers', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 50, governance: 50 } },
    { id: 'swk-crafts', name: 'Native Craftsmen Guild', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 45, governance: 60 } },
    { id: 'swk-court', name: 'Native Court Assessors', ethnicity: 'Sarawak natives', area: 'Both', baseIdeology: { economic: 50, governance: 85 } },
    { id: 'swk-traders', name: 'Baram River Traders', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 70, governance: 60 } },
    { id: 'swk-students', name: 'Native Student Federation', ethnicity: 'Sarawak natives', area: 'Urban', baseIdeology: { economic: 45, governance: 30 } },
    { id: 'swk-loggers', name: 'Native Logging Contractors', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 65, governance: 55 } },
    { id: 'swk-border', name: 'Border Scouts', ethnicity: 'Sarawak natives', area: 'Rural', baseIdeology: { economic: 40, governance: 85 } },
    ];

export const PARTIES: Party[] = [
  { id: 'umno', name: 'UMNO', color: COLOR_PALETTE[3], affiliationIds: ['swk-melanau','nb-coastal','malay-nat', 'malay-prog','malay-royalist','malay-civil','malay-edu','malay-merchant','malay-professional'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Malay', relations: new Map(), unity: 90, ideology: { economic: 50, governance: 75 } },
  { id: 'mca', name: 'MCA', color: COLOR_PALETTE[2], affiliationIds: ['chinese-biz', 'chinese-edu'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Chinese', relations: new Map(), unity: 85, ideology: { economic: 80, governance: 60 } },
  { id: 'mic', name: 'MIC', color: COLOR_PALETTE[4], affiliationIds: ['indian-trad', 'indian-reform'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Indian', relations: new Map(), unity: 80, ideology: { economic: 45, governance: 55 } },
  { id: 'pmip', name: 'PMIP', color: COLOR_PALETTE[1], affiliationIds: ['malay-islamist','malay-intel'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Malay', relations: new Map(), unity: 95, ideology: { economic: 35, governance: 85 } },
  { id: 'pr', name: 'Parti Rakyat', color: COLOR_PALETTE[17], affiliationIds: ['malay-socialist','malay-labour'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Malay', relations: new Map(), unity: 70, ideology: { economic: 20, governance: 50 }  },
  { id: 'labour', name: 'Labour Party', color: COLOR_PALETTE[9], affiliationIds: ['chinese-labour', 'chinese-intel'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [],ethnicityFocus: 'Chinese', relations: new Map(), unity: 75, ideology: { economic: 20, governance: 30 } },
  { id: 'sna', name: 'Sabah National Party', color: COLOR_PALETTE[20], affiliationIds: ['nb-chiefs', 'nb-mission','nb-interior','nb-civil',], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'North Bornean natives', relations: new Map(), unity: 90, ideology: { economic: 50, governance: 75 } },
  { id: 'spp', name: 'Sarawak People Party', color: COLOR_PALETTE[24], affiliationIds: ['swk-longhouse','swk-upriver','swk-officers','swk-mission'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Sarawak natives', relations: new Map(), unity: 90, ideology: { economic: 50, governance: 75 } },
  { id: 'sla', name: 'Sabah Liberal Party', color: COLOR_PALETTE[27], affiliationIds: ['nb-urban-traders', 'nb-gatherers'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'North Bornean natives', relations: new Map(), unity: 90, ideology: { economic: 50, governance: 75 } },
  { id: 'sdp', name: 'Sarawak Democratic Party', color: COLOR_PALETTE[14], affiliationIds: ['swk-church','swk-border','swk-students'], deputyLeaderId: undefined, stateBranches: [], contestedSeats: new Map(), leaderHistory: [], ethnicityFocus: 'Sarawak natives', relations: new Map(), unity: 90, ideology: { economic: 50, governance: 75 } },


];

export const INITIAL_ALLIANCES: PoliticalAlliance[] = [
    {
        id: 'alliance',
        name: 'The Alliance',
        memberPartyIds: ['umno', 'mca', 'mic','sna','spp'],
        type: 'Alliance',
        leaderPartyId: 'umno'
    },
        {
        id: 'socialist',
        name: 'Socialist Front',
        memberPartyIds: ['labour', 'pr', 'sla','sdp','pmip','umno'],
        type: 'Pact',
        leaderPartyId: 'pmip'
    }
];

export const getAffiliationsByEthnicity = (ethnicity: Ethnicity): Affiliation[] => {
  return AFFILIATIONS.filter(a => a.ethnicity === ethnicity);
};

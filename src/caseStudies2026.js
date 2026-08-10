/**
 * Auditable 2026 case studies for the forecast feed and Guided Briefings.
 *
 * Current-status claims are deliberately attributed to the official sources
 * attached to each record. Analytical prompts are framed as questions rather
 * than predictions.
 */
import { AFRICA_MENA_CASE_STUDIES_2026 } from './caseStudiesAfricaMena2026';
import { AMERICAS_GLOBAL_CASE_STUDIES_2026 } from './caseStudiesAmericasGlobal2026';
import { ASIA_PACIFIC_CASE_STUDIES_2026 } from './caseStudiesAsiaPacific2026';

export const CONTENT_REVIEW_DATE = '2026-08-10';

const CORE_CASE_STUDIES_2026 = [
    {
        id: 'sudan-displacement-regional-spillover',
        title: 'Sudan: War, Displacement, and Regional Spillover',
        subtitle: 'How a civil war became the world\'s largest displacement crisis',
        regionTags: ['Africa', 'Horn of Africa', 'Sahel'],
        issueDimensions: ['Armed conflict', 'Forced displacement', 'Humanitarian access', 'Regional security'],
        actors: ['Sudanese Armed Forces', 'Rapid Support Forces', 'Sudanese civilians', 'Neighboring host states', 'UNHCR'],
        nexusNodeIds: ['Africa', 'MilitantPMC', 'UN_OPEC'],
        statusSummary: 'At review on 10 August 2026, UNHCR component figures with cutoffs ranging from 6 July to 3 August summed to 11,344,665 people forcibly displaced by the current crisis. The total comprised 6,490,949 conflict-related internally displaced people inside Sudan, 4,580,635 newly arrived refugees, asylum-seekers and refugee returnees outside Sudan, and 273,081 refugees already in Sudan who had self-relocated. Fighting and civilian harm continued in Darfur, Kordofan and Blue Nile, while the humanitarian response remained underfunded.',
        whyItMatters: 'The case connects state fragmentation, paramilitary power, civilian protection, regional burden-sharing, and the limits of international humanitarian response.',
        updatedAt: '2026-08-10',
        confidence: 'high',
        uncertainty: 'UNHCR products use different caseload scopes. Its separate Sudan country dashboard counted 8,805,506 total internally displaced people as of 30 June, including 2.21 million displaced before April 2023; that total should not be compared directly with the 6,490,949 conflict-related figure. Returns, repeated displacement, differing data cutoffs, access constraints, humanitarian funding, and territorial control also affect the totals.',
        coordinates: { latitude: 15.5007, longitude: 32.5599 },
        broadCategory: 'Geopolitics & Conflict',
        coverageRegion: 'Africa',
        featured: true,
        sensitivity: 'high',
        editorialCaution: 'Use dated, scoped displacement figures and attribute conflict, protection, and funding claims. Do not infer control, responsibility, or civilian experience from a single institutional dataset.',
        reviewCadenceDays: 14,
        reviewBy: '2026-08-24',
        map: {
            mode: 'regional',
            locations: [
                { label: 'Khartoum', latitude: 15.5007, longitude: 32.5599, role: 'National-capital and conflict reference point' },
                { label: 'El Fasher', latitude: 13.6279, longitude: 25.3494, role: 'Darfur conflict and displacement reference point' },
                { label: 'Port Sudan', latitude: 19.6158, longitude: 37.2164, role: 'Administrative and humanitarian-logistics reference point' },
                { label: 'Adré, Chad', latitude: 13.4667, longitude: 22.2, role: 'Cross-border refugee-reception reference point' },
            ],
        },
        sources: [
            {
                title: 'Emergency Response Rooms work in Sudan – we could change aid models in other warzones',
                publisher: 'Chatham House',
                publishedAt: '2026-06-15',
                url: 'https://www.chathamhouse.org/publications/the-world-today/2026-06/emergency-response-rooms-work-sudan-we-could-change-aid-models',
                perspectiveType: 'local',
                perspective: 'Sudanese Emergency Response Room volunteer perspective on locally led mutual aid',
                supports: 'How community-run Emergency Response Rooms operate, the risks volunteers face, and the case for direct support to Sudanese mutual-aid structures',
            },
            {
                title: 'Sudan situation',
                publisher: 'UNHCR Operational Data Portal',
                publishedAt: null,
                sourceType: 'living-reference',
                reviewedAt: CONTENT_REVIEW_DATE,
                url: 'https://data.unhcr.org/en/situations/sudansituation',
                perspectiveType: 'institutional',
                perspective: 'United Nations operational reporting with component-specific data cutoffs',
                supports: 'Current conflict-related displacement totals inside Sudan, cross-border movements, self-relocation, and regional response context',
            },
            {
                title: 'More than 300 children killed or injured in Sudan war in 6 months, UNICEF says',
                publisher: 'Associated Press',
                publishedAt: '2026-07-06',
                url: 'https://apnews.com/article/sudan-war-children-drone-rsf-army-9ac6245afb2c0e3cfc96da5ceda14f48',
                perspectiveType: 'independent',
                perspective: 'Independent reporting on civilian harm, conflict geography, aid access, and regional effects',
                supports: 'Continued attacks on civilians, humanitarian constraints, and the conflict\'s effects on children and neighboring host states',
            },
        ],
        supplementalSources: [
            {
                title: 'Sudanese communities are rebuilding under fire. Will Berlin back them?',
                publisher: 'The New Humanitarian',
                publishedAt: '2026-04-14',
                url: 'https://www.thenewhumanitarian.org/opinion/2026/04/14/sudanese-communities-are-rebuilding-under-fire-will-berlin-back-them',
                perspective: 'Earlier Sudanese civil-society and mutual-aid account retained for historical context',
            },
            {
                title: 'Three years on, war-weary Sudanese remain on the move',
                publisher: 'UNHCR',
                publishedAt: '2026-04-10',
                url: 'https://www.unhcr.org/news/briefing-notes/three-years-war-weary-sudanese-remain-move',
                perspective: 'Dated humanitarian snapshot retained to make changes in scope and caseload visible',
            },
            {
                title: 'Sudan enters a fourth year of war as officials lament an abandoned crisis',
                publisher: 'Associated Press',
                publishedAt: '2026-04-15',
                url: 'https://apnews.com/article/32a416bfbd680ea42edf6c0298d2617b',
                perspective: 'Earlier independent reporting on regional involvement, hunger, displacement, and failed mediation',
            },
            {
                title: 'Noon briefing of 9 July 2026',
                publisher: 'United Nations',
                publishedAt: '2026-07-09',
                url: 'https://www.un.org/sg/en/content/highlight/2026-07-09.html',
                perspective: 'Official dated statement on the 2026 Sudan Humanitarian Response Plan funding gap',
            },
        ],
        waypoints: [
            {
                nodeId: 'Africa',
                title: 'A War Without an Endpoint',
                perspectiveLabel: 'Independent and United Nations reporting',
                perspectiveType: 'independent',
                narration: 'Independent and United Nations reporting reviewed in August 2026 described continued fighting and civilian harm in Darfur, Kordofan and Blue Nile.',
                focusQuestion: 'What prevents military pressure from becoming a durable political settlement?',
            },
            {
                nodeId: 'MilitantPMC',
                title: 'State and Paramilitary Power',
                perspectiveLabel: 'Civilian protection across competing armed authorities',
                perspectiveType: 'synthesis',
                narration: 'The conflict pits the Sudanese Armed Forces against the paramilitary Rapid Support Forces, while civilians absorb the central protection costs.',
                focusQuestion: 'How does a powerful paramilitary organization alter conventional ideas of sovereignty?',
            },
            {
                nodeId: 'Africa',
                title: 'Displacement Across Borders',
                perspectiveLabel: 'UNHCR operational data',
                perspectiveType: 'institutional',
                narration: 'UNHCR\'s living portal recorded 6,490,949 conflict-related internally displaced people, 4,580,635 new cross-border arrivals and returns, and 273,081 self-relocated refugees, with component data cutoffs ranging from 6 July to 3 August 2026.',
                focusQuestion: 'When does a domestic conflict become a regional security and development crisis?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'A Response Under Strain',
                perspectiveLabel: 'United Nations humanitarian response',
                perspectiveType: 'institutional',
                narration: 'On 9 July, the United Nations said the 2026 Sudan Humanitarian Response Plan had received $930 million of the nearly $2.9 billion required—less than one third.',
                focusQuestion: 'What obligations should outside states accept when humanitarian need greatly exceeds available funding?',
            },
        ],
    },
    {
        id: 'myanmar-fragmented-sovereignty',
        title: 'Myanmar: Fragmented Sovereignty and Humanitarian Access',
        subtitle: 'Conflict, displacement, and the struggle to reach civilians',
        regionTags: ['Asia', 'Southeast Asia'],
        issueDimensions: ['Contested sovereignty', 'Armed conflict', 'Humanitarian access', 'Displacement'],
        actors: ['Myanmar military authorities', 'Resistance organizations', 'Ethnic armed organizations', 'Myanmar civilians', 'OCHA and humanitarian partners'],
        nexusNodeIds: ['AsiaPacific', 'UN_OPEC'],
        statusSummary: 'OCHA reported on 13 July 2026 that more than 16 million people needed humanitarian assistance and nearly 3.8 million were displaced, while conflict, movement restrictions, and administrative requirements continued to obstruct aid access.',
        whyItMatters: 'Myanmar shows how competing claims to authority, territorial fragmentation, and restricted humanitarian access can weaken both domestic governance and regional diplomacy.',
        updatedAt: '2026-07-13',
        confidence: 'high',
        uncertainty: 'Access constraints limit independent observation, so casualty counts, local control, and new displacement estimates require cautious attribution and frequent updates.',
        coordinates: { latitude: 19.7633, longitude: 96.0785 },
        broadCategory: 'Geopolitics & Conflict',
        sources: [
            {
                title: '150,000 People Displaced by Fighting in Pakokku in Urgent Need',
                publisher: 'The Irrawaddy',
                publishedAt: '2026-07-02',
                url: 'https://www.irrawaddy.com/news/burma/150000-people-displaced-by-fighting-in-pakokku-in-urgent-need.html',
                perspectiveType: 'local',
                perspective: 'Myanmar reporting centered on displaced families and local aid workers',
                supports: 'Local access, shelter, medicine, food, and displacement conditions in central Myanmar',
            },
            {
                title: 'Myanmar Humanitarian Update No. 52',
                publisher: 'OCHA / United Nations in Myanmar',
                publishedAt: '2026-07-13',
                url: 'https://myanmar.un.org/en/319232-myanmar-humanitarian-update-no-52',
                alternateUrls: [
                    {
                        label: 'Open the official OCHA PDF directly',
                        url: 'https://myanmar.un.org/en/download/212411/319232',
                    },
                ],
                perspectiveType: 'institutional',
                perspective: 'United Nations humanitarian situation and response reporting',
                supports: 'National assistance needs, displacement estimates, access barriers, and response funding',
            },
            {
                title: 'Situation of human rights in Myanmar',
                publisher: 'Office of the UN High Commissioner for Human Rights',
                publishedAt: '2026-06-22',
                url: 'https://bangkok.ohchr.org/myanmar',
                perspectiveType: 'independent',
                perspective: 'Independent human-rights monitoring of all major conflict actors',
                supports: 'Civilian protection, accountability, inclusive governance, and limits on humanitarian access',
            },
        ],
        waypoints: [
            {
                nodeId: 'AsiaPacific',
                title: 'A Nationwide Humanitarian Crisis',
                narration: 'OCHA estimated that more than 16 million people needed assistance across Myanmar in July 2026.',
                focusQuestion: 'What does widespread humanitarian need reveal about the state\'s capacity and legitimacy?',
            },
            {
                nodeId: 'AsiaPacific',
                title: 'Repeated Displacement',
                narration: 'Nearly 3.8 million people were estimated to be displaced, with renewed fighting continuing to force new movements.',
                focusQuestion: 'How does repeated displacement change communities\' political and economic choices?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'Blocked Humanitarian Reach',
                narration: 'OCHA identified hostilities, movement restrictions, and administrative requirements as continuing barriers to aid.',
                focusQuestion: 'How can humanitarian actors remain neutral while negotiating access with competing authorities?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'The Response Gap',
                narration: 'By the end of March, partners had reached 1.6 million people, while the 2026 response was 43 percent funded in the July update.',
                focusQuestion: 'How should scarce assistance be prioritized when the target population cannot all be reached?',
            },
        ],
    },
    {
        id: 'south-china-sea-arbitral-award-ten-years',
        title: 'South China Sea: Ten Years After the Arbitral Award',
        subtitle: 'International law, competing state positions, and maritime order',
        regionTags: ['Asia-Pacific', 'Southeast Asia', 'South China Sea'],
        issueDimensions: ['Maritime entitlements', 'International law', 'Dispute settlement', 'Regional security'],
        actors: ['Philippines', 'China', 'Annex VII arbitral tribunal', 'Southeast Asian coastal states'],
        nexusNodeIds: ['AsiaPacific', 'China', 'UN_OPEC'],
        statusSummary: 'Ten years after the 2016 award, the Philippine government continues to present it as a final and binding guide to maritime rights under UNCLOS, while China\'s government continues to reject the arbitration and award as invalid. These are attributed government positions; the underlying award addressed maritime entitlements and conduct, not sovereignty over land territory or boundary delimitation.',
        whyItMatters: 'The dispute offers a direct test of the relationship between formal legal decisions, state consent, material power, and peaceful management of competing maritime claims.',
        updatedAt: '2026-07-21',
        confidence: 'high',
        uncertainty: 'Official descriptions of incidents and legal meaning are contested. Each state claim should remain attributed, and operational developments at sea require separate, incident-specific verification.',
        coordinates: { latitude: 12, longitude: 114 },
        broadCategory: 'Geopolitics & Conflict',
        sources: [
            {
                title: 'Delhi Roundtable Accentuates Abiding Relevance of South China Sea Arbitral Award on Decennial',
                publisher: 'Department of Foreign Affairs of the Philippines',
                publishedAt: '2026-07-21',
                url: 'https://newdelhipe.dfa.gov.ph/index.php/newsroom/embassy-news/1230-delhi-roundtable-accentuates-abiding-relevance-of-south-china-sea-arbitral-award-on-decennial',
                perspectiveType: 'local',
                perspective: 'Official Philippine government position supporting the award',
                supports: 'The Philippine legal and rules-based-maritime-order position',
            },
            {
                title: 'The South China Sea Arbitration: Award of 12 July 2016',
                publisher: 'Permanent Court of Arbitration (registry)',
                publishedAt: '2016-07-12',
                url: 'https://docs.pca-cpa.org/2016/07/PH-CN-20160712-Award.pdf',
                perspectiveType: 'institutional',
                perspective: 'Official text of the Annex VII arbitral tribunal award',
                supports: 'The tribunal\'s jurisdictional reasoning, findings, and limited legal scope',
            },
            {
                title: 'Philippines commemorates 2016 South China Sea ruling rejected by Beijing',
                publisher: 'Associated Press',
                publishedAt: '2026-07-10',
                url: 'https://apnews.com/article/d0148a4175f80eedf70dcf2696f03ddd',
                perspectiveType: 'independent',
                perspective: 'Independent account presenting Philippine, Chinese, and wider regional positions',
                supports: 'The gap between the award\'s legal authority and its political enforcement',
            },
        ],
        supplementalSources: [
            {
                title: 'Foreign Ministry Spokesperson Lin Jian\'s Regular Press Conference on July 14, 2026',
                publisher: 'Ministry of Foreign Affairs of the People\'s Republic of China',
                publishedAt: '2026-07-14',
                url: 'https://www.mfa.gov.cn/eng/xw/fyrbt/202607/t20260714_11982116.html',
                perspective: 'Official Chinese government position rejecting the arbitration and award',
            },
        ],
        waypoints: [
            {
                nodeId: 'AsiaPacific',
                title: 'What the Tribunal Decided',
                narration: 'The tribunal addressed maritime entitlements and conduct under UNCLOS; it did not decide sovereignty over land territory or delimit a maritime boundary.',
                focusQuestion: 'Why does the legal scope of a ruling matter as much as its outcome?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'Law as a Dispute Mechanism',
                narration: 'The 2016 award supplies a formal legal record against which later state arguments and conduct can be evaluated.',
                focusQuestion: 'What gives an international legal decision influence when enforcement is decentralized?',
            },
            {
                nodeId: 'China',
                title: 'China\'s Rejection',
                narration: 'China\'s Foreign Ministry says the tribunal lacked authority and that disputes should be handled through negotiation by the parties concerned.',
                focusQuestion: 'How does state consent shape the legitimacy of international adjudication?',
            },
            {
                nodeId: 'AsiaPacific',
                title: 'The Philippine Position',
                narration: 'The Philippine government treats the award as final, binding, and central to a rules-based maritime order.',
                focusQuestion: 'How can a smaller state use legal institutions to offset an asymmetry in material power?',
            },
        ],
    },
    {
        id: 'syria-transition-return-sanctions',
        title: 'Syria: Political Transition, Return, and Sanctions Relief',
        subtitle: 'Large-scale return inside a still-fragile recovery system',
        regionTags: ['Middle East', 'Levant'],
        issueDimensions: ['Political transition', 'Refugee return', 'Sanctions', 'Reconstruction'],
        actors: ['Syrian transitional authorities', 'Syrian refugees and internally displaced people', 'UNHCR', 'European Union', 'Neighboring host states'],
        nexusNodeIds: ['MiddleEast', 'Europe', 'UN_OPEC'],
        statusSummary: 'UNHCR reported in March 2026 that 15.6 million people required assistance and that more than 1.5 million refugees and 1.8 million internally displaced people had returned since December 2024. In May 2026, the EU renewed targeted measures against former-regime networks while describing broad economic sanctions as having been lifted in 2025 to support transition and recovery.',
        whyItMatters: 'Syria tests whether political transition and sanctions relief can produce voluntary, safe, and sustainable return before housing, services, livelihoods, documentation, and accountable institutions have recovered.',
        updatedAt: '2026-06-30',
        confidence: 'high',
        uncertainty: 'Return totals change frequently and conditions vary sharply by locality. A recorded return must not be treated as proof that return was safe, voluntary, or sustainable.',
        coordinates: { latitude: 33.5138, longitude: 36.2765 },
        broadCategory: 'Geopolitics & Conflict',
        sources: [
            {
                title: 'Syria: One Year After Political Change, Peace Spring Areas Block Displaced Persons’ Return',
                publisher: 'Syrians for Truth and Justice',
                publishedAt: '2026-06-30',
                url: 'https://stj-sy.org/en/syria-one-year-after-political-change-peace-spring-areas-block-displaced-persons-return/',
                perspectiveType: 'local',
                perspective: 'Syrian documentation of property, security, and return barriers in contested localities',
                supports: 'Why a recorded return or political transition does not establish safe, equitable reintegration',
            },
            {
                title: 'Syria: Council renews restrictive measures targeting the former al-Assad regime for one year and de-lists certain entities',
                publisher: 'Council of the European Union',
                publishedAt: '2026-05-18',
                url: 'https://www.consilium.europa.eu/en/press/press-releases/2026/05/18/syria-council-renews-restrictive-measures-targeting-the-former-al-assad-regime-for-one-year-and-de-lists-certain-entities/',
                perspectiveType: 'institutional',
                perspective: 'Official European Union sanctions and engagement policy',
                supports: 'The distinction between broad sanctions relief and targeted accountability measures',
            },
            {
                title: 'Beyond safety and necessity: Understanding Syria’s mass return',
                publisher: 'University of Oxford COMPAS',
                publishedAt: '2026-05-22',
                url: 'https://www.compas.ox.ac.uk/article/beyond-safety-and-necessity-understanding-syrias-mass-return',
                perspectiveType: 'independent',
                perspective: 'Independent migration research centered on returnees’ lived experience',
                supports: 'The difference between physical return, belonging, livelihood recovery, and sustainable reintegration',
            },
        ],
        supplementalSources: [
            {
                title: 'Operational Update – Syria, March 2026',
                publisher: 'UNHCR',
                publishedAt: '2026-04-21',
                url: 'https://www.unhcr.org/sites/default/files/2026-04/unhcr-syria-operational-update-march.pdf',
                perspective: 'United Nations protection, return, and humanitarian reporting',
            },
        ],
        waypoints: [
            {
                nodeId: 'MiddleEast',
                title: 'A Changed Political Context',
                narration: 'UNHCR describes a post-December 2024 environment in which political change and large-scale returns coexist with severe humanitarian need.',
                focusQuestion: 'When does a change in government become a durable political transition?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'Return at Scale',
                narration: 'By March 2026, UNHCR counted more than 1.5 million refugee returns and 1.8 million returns by internally displaced people since December 2024.',
                focusQuestion: 'Which indicators show whether a return is sustainable rather than temporary?',
            },
            {
                nodeId: 'Europe',
                title: 'Sanctions Recalibrated',
                narration: 'The EU says broad economic sanctions were lifted to support transition and recovery while targeted measures against former-regime networks remain.',
                focusQuestion: 'Can targeted sanctions preserve accountability without obstructing wider recovery?',
            },
            {
                nodeId: 'MiddleEast',
                title: 'The Reintegration Test',
                narration: 'UNHCR identifies damaged housing, limited services and livelihoods, documentation needs, and local capacity as constraints on sustainable return.',
                focusQuestion: 'Who should bear the cost and responsibility for rebuilding the conditions needed for return?',
            },
        ],
    },
    {
        id: 'guyana-venezuela-essequibo-icj',
        title: 'Guyana–Venezuela: Essequibo Before the ICJ',
        subtitle: 'A territorial controversy moves through international adjudication',
        regionTags: ['Latin America', 'Caribbean', 'Northern South America'],
        issueDimensions: ['Territorial sovereignty', 'International adjudication', 'Regional diplomacy', 'Peaceful dispute settlement'],
        actors: ['Guyana', 'Venezuela', 'International Court of Justice', 'CARICOM'],
        nexusNodeIds: ['LatinAmerica', 'UN_OPEC'],
        statusSummary: 'As reviewed on 10 August 2026, the International Court of Justice docket\'s latest development remained the conclusion of merits hearings held from 4 to 11 May 2026; the merits judgment was still pending. CARICOM\'s 10 July communiqué reaffirmed support for the judicial process and for Guyana\'s sovereignty and territorial integrity. Venezuela\'s Foreign Ministry stated on 6 May that it does not recognize the Court\'s jurisdiction in this matter and regards the 1966 Geneva Agreement as the valid route to resolution.',
        whyItMatters: 'The case tests whether international adjudication and regional diplomacy can manage a high-stakes territorial controversy without coercive alteration of the status quo.',
        updatedAt: '2026-08-10',
        confidence: 'high',
        uncertainty: 'The Court has not announced a judgment date. Timing estimates from officials or media must not be presented as a Court schedule, and neither side\'s prediction of the merits outcome should be treated as fact. CARICOM\'s support for Guyana and Venezuela\'s jurisdictional objection remain attributed policy positions.',
        coordinates: { latitude: 6.4, longitude: -59 },
        broadCategory: 'Geopolitics & Conflict',
        coverageRegion: 'Latin America & Caribbean',
        featured: false,
        sensitivity: 'high',
        editorialCaution: 'Attribute each government and regional institution\'s legal position, do not treat advocacy as the Court\'s finding, and do not forecast the judgment or imply a Court timetable.',
        reviewCadenceDays: 14,
        reviewBy: '2026-08-24',
        map: {
            mode: 'regional',
            locations: [
                { label: 'Georgetown', latitude: 6.8013, longitude: -58.1551, role: 'Guyana government and affected-country reference point' },
                { label: 'Caracas', latitude: 10.4806, longitude: -66.9036, role: 'Venezuela government reference point' },
                { label: 'The Hague', latitude: 52.0809, longitude: 4.313, role: 'International Court of Justice proceedings' },
            ],
        },
        sources: [
            {
                title: 'Communiqué: Fifty-First Regular Meeting of the Conference of Heads of Government of CARICOM',
                publisher: 'Caribbean Community',
                publishedAt: '2026-07-10',
                url: 'https://caricom.org/communique-fifty-first-regular-meeting-of-the-conference-of-heads-of-government-of-the-caribbean-community-caricom-saint-lucia/',
                perspectiveType: 'local',
                perspective: 'Official CARICOM proceeding summary and regional policy position supporting Guyana',
                supports: 'The Caribbean regional-security and peaceful-settlement perspective',
            },
            {
                title: 'Arbitral Award of 3 October 1899 (Guyana v. Venezuela)',
                publisher: 'International Court of Justice',
                publishedAt: null,
                sourceType: 'living-reference',
                reviewedAt: CONTENT_REVIEW_DATE,
                milestoneDate: '2026-05-11',
                milestoneLabel: 'Merits hearings concluded',
                url: 'https://www.icj-cij.org/case/171',
                alternateUrls: [
                    {
                        label: 'Open the current ICJ docket mirror',
                        url: 'https://icj-web.leman.un-icc.cloud/case/171',
                    },
                ],
                perspectiveType: 'institutional',
                perspective: 'Official Court docket and procedural record; the page is updated as the case develops',
                supports: 'The Court\'s jurisdiction, orders, filings, hearings, and eventual merits judgment',
            },
            {
                title: 'Guyana and Venezuela return to UN court to settle historic dispute over valuable border region',
                publisher: 'Associated Press',
                publishedAt: '2026-05-04',
                url: 'https://apnews.com/article/2c9d13b0dbcf7f92d6f53264003ce626',
                perspectiveType: 'independent',
                perspective: 'Independent reporting presenting the core Guyanese and Venezuelan arguments',
                supports: 'The historical, resource, sovereignty, and jurisdictional stakes presented at the merits hearings',
            },
        ],
        supplementalSources: [
            {
                title: 'Venezuela desmontó ante la CIJ argumentos de Guyana y ratifica Acuerdo de Ginebra',
                publisher: 'Ministry of Foreign Affairs of Venezuela',
                publishedAt: '2026-05-06',
                url: 'https://mppre.gob.ve/publicacion/7224-venezuela-desmonto-ante-la-cij-argumentos-de-guyana-y-ratifica-acuerdo-de-ginebra',
                perspective: 'Official Venezuelan position rejecting the Court\'s jurisdiction and prioritizing the 1966 Geneva Agreement',
            },
        ],
        waypoints: [
            {
                nodeId: 'LatinAmerica',
                title: 'A Regional Territorial Controversy',
                perspectiveLabel: 'Guyana and Venezuela',
                perspectiveType: 'synthesis',
                narration: 'Guyana pursues adjudication before the International Court of Justice, while Venezuela appeared at the 2026 hearings but maintains that it does not recognize the Court\'s jurisdiction in this matter.',
                focusQuestion: 'Why might states choose adjudication instead of bilateral bargaining?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'The Merits Heard',
                perspectiveLabel: 'International Court of Justice',
                perspectiveType: 'institutional',
                narration: 'CARICOM reported that the Court heard two rounds of oral argument from 4 to 11 May 2026.',
                focusQuestion: 'What can an international court resolve, and what political work remains outside the courtroom?',
            },
            {
                nodeId: 'LatinAmerica',
                title: 'CARICOM\'s Position',
                perspectiveLabel: 'Caribbean Community',
                perspectiveType: 'local',
                narration: 'CARICOM supports the judicial process and has explicitly reaffirmed its support for Guyana\'s sovereignty and territorial integrity.',
                focusQuestion: 'How can regional solidarity affect a dispute without deciding its legal merits?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'Judgment Pending',
                perspectiveLabel: 'Court record and editorial caution',
                perspectiveType: 'synthesis',
                narration: 'The Court has not yet delivered its merits judgment, so the outcome remains open.',
                focusQuestion: 'What should responsible analysis avoid while a binding judgment is still pending?',
            },
        ],
    },
    {
        id: 'usmca-2026-joint-review',
        title: 'USMCA After the 2026 Joint Review',
        subtitle: 'Integration continues while annual bargaining replaces immediate extension',
        regionTags: ['North America', 'United States', 'Mexico', 'Canada'],
        issueDimensions: ['Regional trade', 'Economic security', 'Industrial policy', 'Supply-chain integration'],
        actors: ['United States', 'Mexico', 'Canada', 'North American workers', 'Manufacturers and agricultural producers'],
        nexusNodeIds: ['USA', 'LatinAmerica'],
        statusSummary: 'The United States declined an immediate 16-year extension at the 1 July 2026 joint review. Official statements from all three countries say the agreement remains in force while negotiations continue; Canadian and Mexican statements specify that it remains in force through 2036 and that annual reviews will continue.',
        whyItMatters: 'USMCA makes it possible to examine how deeply integrated economies use recurring negotiations to balance shared production networks against national industrial and political priorities.',
        updatedAt: '2026-07-23',
        confidence: 'high',
        uncertainty: 'Negotiations remain active and each government frames the review differently. Failure to grant an immediate extension must not be described as termination of the agreement.',
        coordinates: { latitude: 39, longitude: -101 },
        broadCategory: 'Economy & Trade',
        sources: [
            {
                title: 'Quinta Reunión de la Comisión de Libre Comercio del T-MEC: Proceso de Revisión Conjunta previsto en el artículo 34.7',
                publisher: 'Secretaría de Economía de México',
                publishedAt: '2026-07-01',
                url: 'https://www.gob.mx/se/prensa/quinta-reunion-de-la-comision-de-libre-comercio-del-t-mec-proceso-de-revision-conjunta-previsto-en-el-articulo-34-7?idiom=es-MX',
                perspectiveType: 'local',
                perspective: 'Mexican account of the joint review, continued term, and annual-review process',
                supports: 'Mexico\'s regional-integration, industrial, and continued-agreement position',
            },
            {
                title: 'American Farmers, Ranchers, Manufacturers, and Businesses Applaud President Trump for Not Rubber Stamping the USMCA',
                publisher: 'Office of the United States Trade Representative',
                publishedAt: '2026-07-02',
                url: 'https://www.ustr.gov/about/policy-offices/press-office/press-releases/2026/july/american-farmers-ranchers-manufacturers-and-businesses-applaud-president-trump-not-rubber-stamping',
                perspectiveType: 'institutional',
                perspective: 'Official United States position explaining the decision not to extend immediately',
                supports: 'The United States bargaining and economic-security rationale',
            },
            {
                title: 'The United States Has Opted Not to Extend the USMCA',
                publisher: 'Center for Strategic and International Studies',
                publishedAt: '2026-07-06',
                url: 'https://www.csis.org/analysis/united-states-has-opted-not-extend-usmca',
                perspectiveType: 'independent',
                perspective: 'Independent analysis of the legal timeline and economic costs of recurring review',
                supports: 'The distinction between non-extension, annual review, and termination',
            },
        ],
        supplementalSources: [
            {
                title: 'Minister LeBlanc updates provincial and territorial ministers responsible for International Trade on CUSMA Joint Review',
                publisher: 'Global Affairs Canada',
                publishedAt: '2026-07-03',
                url: 'https://www.canada.ca/en/global-affairs/news/2026/07/minister-leblanc-updates-provincial-and-territorial-ministers-responsible-for-international-trade-on-cusma-joint-review.html',
                perspective: 'Official Canadian account emphasizing continuity and Canadian priorities',
            },
        ],
        waypoints: [
            {
                nodeId: 'USA',
                title: 'No Immediate Extension',
                narration: 'USTR says the United States declined to extend USMCA automatically while it seeks changes through further negotiation.',
                focusQuestion: 'When does withholding certainty create useful leverage, and when does it impose excessive cost?',
            },
            {
                nodeId: 'LatinAmerica',
                title: 'The Agreement Continues',
                narration: 'Canadian and Mexican official statements emphasize that USMCA remains in force through 2036 despite the absence of an immediate extension.',
                focusQuestion: 'Why is the distinction between continuation and extension politically important?',
            },
            {
                nodeId: 'USA',
                title: 'Industrial Bargaining',
                narration: 'Official updates describe continuing talks over steel, aluminum, strategic sectors, and regional supply chains.',
                focusQuestion: 'Who gains and who loses when trade rules are redesigned around economic security?',
            },
            {
                nodeId: 'LatinAmerica',
                title: 'Competing National Narratives',
                narration: 'The three governments frame the review differently while agreeing that negotiation and the agreement itself continue.',
                focusQuestion: 'How should analysts separate a government\'s negotiating message from the agreement\'s legal status?',
            },
        ],
    },
    {
        id: 'tuvalu-australia-falepili-union',
        title: 'Tuvalu–Australia Falepili Union',
        subtitle: 'Climate mobility, continuing statehood, and a new security partnership',
        regionTags: ['Pacific', 'Oceania', 'Small Island States'],
        issueDimensions: ['Climate mobility', 'Continuing statehood', 'Adaptation', 'Asymmetric security partnership'],
        actors: ['Tuvalu', 'Australia', 'Tuvaluan citizens'],
        nexusNodeIds: ['AsiaPacific', 'UN_OPEC'],
        statusSummary: 'The Falepili Union entered into force on 28 August 2024. The treaty recognizes Tuvalu\'s continuing statehood and sovereignty despite climate-related sea-level rise and establishes a permanent-residence mobility pathway. For the 2026–27 program year, Australia allocated up to 280 visa places. Registration closed on 1 June 2026, while the published selection period runs from 9 June 2026 through 30 June 2027.',
        whyItMatters: 'The arrangement links climate adaptation, mobility, legal continuity of a threatened state, culture, and security cooperation without treating mobility participants as refugees.',
        updatedAt: '2026-08-10',
        confidence: 'high',
        uncertainty: 'The published selection window extends through 30 June 2027; registration having closed does not mean that all places have been filled. Annual allocations and administrative timing can change. The pathway is permanent-residence mobility, not formal refugee recognition, and claims about demographic or brain-drain effects need separate evidence.',
        coordinates: { latitude: -8.5211, longitude: 179.1962 },
        broadCategory: 'Environment & Energy',
        coverageRegion: 'Pacific',
        featured: false,
        sensitivity: 'high',
        editorialCaution: 'Describe the pathway as permanent-residence mobility rather than refugee status, preserve Tuvaluan agency, and distinguish registration, random selection, visa application, and actual migration.',
        reviewCadenceDays: 30,
        reviewBy: '2026-09-09',
        map: {
            mode: 'regional',
            locations: [
                { label: 'Funafuti', latitude: -8.5211, longitude: 179.1962, role: 'Tuvaluan government, community, and climate-continuity reference point' },
                { label: 'Canberra', latitude: -35.2809, longitude: 149.13, role: 'Australian treaty and mobility-policy administration' },
            ],
        },
        sources: [
            {
                title: 'Hope in Tuvalu’s climate change response: Falepili to Digital Nation',
                publisher: 'Development Policy Centre',
                publishedAt: '2026-02-20',
                url: 'https://devpolicy.org/hope-in-tuvalus-climate-change-response-from-falepili-to-digital-nation-20260220/',
                perspectiveType: 'local',
                perspective: 'Tuvalu-centered account of mobility, culture, state continuity, and local adaptation choices',
                supports: 'Why Tuvaluan agency and cultural continuity should not be reduced to a climate-loss narrative',
            },
            {
                title: 'Pacific Engagement visa (subclass 192) – Treaty stream ballot registration',
                publisher: 'Australian Department of Home Affairs',
                publishedAt: null,
                sourceType: 'living-reference',
                updatedAt: '2026-04-16',
                reviewedAt: CONTENT_REVIEW_DATE,
                url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/pacific-engagement/subclass-192-treaty-stream/ballot-registration',
                perspectiveType: 'institutional',
                perspective: 'Official eligibility, allocation, and 2026 ballot information',
                supports: 'The pathway\'s legal status, annual allocation, and administrative operation',
            },
            {
                title: 'An Unthinkable Question: Tuvalu and the Falepili Union',
                publisher: 'Victoria University of Wellington Law Review',
                publishedAt: '2026-06-15',
                url: 'https://ojs.victoria.ac.nz/vuwlr/article/view/10760',
                perspectiveType: 'independent',
                perspective: 'Independent legal analysis of mobility, security, sovereignty, and continuing statehood',
                supports: 'The treaty\'s legal innovations and tensions between protection and asymmetric security commitments',
            },
        ],
        supplementalSources: [
            {
                title: 'Australia–Tuvalu Falepili Union treaty',
                publisher: 'Australian Department of Foreign Affairs and Trade',
                publishedAt: null,
                sourceType: 'living-reference',
                reviewedAt: CONTENT_REVIEW_DATE,
                milestoneDate: '2024-08-28',
                milestoneLabel: 'Treaty entered into force',
                url: 'https://www.dfat.gov.au/geo/tuvalu/australia-tuvalu-falepili-union-treaty',
                perspective: 'Current official treaty and implementation overview',
            },
            {
                title: 'Treaty stream ballot country status',
                publisher: 'Australian Department of Home Affairs',
                publishedAt: null,
                sourceType: 'living-reference',
                reviewedAt: CONTENT_REVIEW_DATE,
                milestoneDate: '2027-06-30',
                milestoneLabel: 'Published 2026–27 selection period ends',
                url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/pacific-engagement/subclass-192-treaty-stream/ballot-registration/ballot-country-status',
                perspective: 'Official status and timing for the Tuvalu Treaty stream ballot',
            },
        ],
        waypoints: [
            {
                nodeId: 'AsiaPacific',
                title: 'Continuing Statehood',
                perspectiveLabel: 'Tuvalu and Australia treaty framework',
                perspectiveType: 'institutional',
                narration: 'Australia says the treaty legally recognizes Tuvalu\'s continuing statehood and sovereignty despite climate-related sea-level rise.',
                focusQuestion: 'Can statehood remain legally continuous if habitable territory is severely reduced?',
            },
            {
                nodeId: 'AsiaPacific',
                title: 'Mobility With Dignity',
                perspectiveLabel: 'Tuvaluan agency and community continuity',
                perspectiveType: 'local',
                narration: 'The pathway offers permanent residence in Australia to selected Tuvaluan citizens and their eligible families; it is not refugee status.',
                focusQuestion: 'How can mobility policy preserve choice, culture, and connection to home?',
            },
            {
                nodeId: 'AsiaPacific',
                title: 'A Limited Annual Pathway',
                perspectiveLabel: 'Australian Department of Home Affairs',
                perspectiveType: 'institutional',
                narration: 'Australia allocated up to 280 places for the 2026–27 program year. Registration closed on 1 June 2026, and the published selection period continues through 30 June 2027.',
                focusQuestion: 'What does a fair allocation process look like when demand exceeds available places?',
            },
            {
                nodeId: 'UN_OPEC',
                title: 'A Wider Legal Precedent',
                perspectiveLabel: 'International-law implications',
                perspectiveType: 'synthesis',
                narration: 'The bilateral recognition of continuing statehood raises broader questions for international responses to sea-level rise.',
                focusQuestion: 'Should international law adopt a general rule protecting statehood and maritime rights as seas rise?',
            },
        ],
    },
    {
        id: 'greenland-autonomy-security-minerals',
        title: 'Greenland: Autonomy, Arctic Security, and Critical Minerals',
        subtitle: 'Self-determination inside an increasingly strategic Arctic',
        regionTags: ['Arctic', 'Greenland', 'North Atlantic'],
        issueDimensions: ['Self-determination', 'Arctic security', 'Critical minerals', 'Local participation'],
        actors: ['Government of Greenland', 'Greenlandic public', 'Denmark', 'NATO allies', 'United States and European Union mineral partners'],
        nexusNodeIds: ['Europe', 'USA', 'NATO', 'TechAIHub'],
        statusSummary: 'Greenland and Denmark announced an expanded military presence and continued allied exercises in and around Greenland on 14 January 2026. The Section 21 Commission held its constituting meeting on 18 March and is expected to deliver a legal study after one working year. On 9 July, after President Donald Trump renewed his demand for United States control, Greenland\'s prime minister again said Greenland was not for sale and called for respect for territorial integrity, international law, and Greenlandic self-determination. Greenland\'s 2025–2029 mineral strategy continues to emphasize sustainability, local benefit, critical minerals, and diversified international partnerships.',
        whyItMatters: 'Greenland brings self-determination, local consent, alliance security, Arctic strategic change, and competition for critical-mineral supply chains into one case without reducing Greenland to an object of outside strategy.',
        updatedAt: '2026-08-10',
        confidence: 'high',
        uncertainty: 'Security, autonomy, independence law, and mineral development are distinct policy tracks. External geopolitical rhetoric changes rapidly and should not be confused with a negotiated policy outcome. Mineral potential must not be presented as proven commercially recoverable reserves.',
        coordinates: { latitude: 64.1814, longitude: -51.6941 },
        broadCategory: 'Geopolitics & Conflict',
        coverageRegion: 'Arctic',
        featured: false,
        sensitivity: 'high',
        editorialCaution: 'Center Greenlandic consent and distinguish political rhetoric, announced exercises, legal study, mineral potential, and commercially demonstrated reserves. Do not imply that an independence decision or transfer of control is imminent.',
        reviewCadenceDays: 14,
        reviewBy: '2026-08-24',
        map: {
            mode: 'regional',
            locations: [
                { label: 'Nuuk', latitude: 64.1814, longitude: -51.6941, role: 'Greenlandic government and public-agency reference point' },
                { label: 'Copenhagen', latitude: 55.6761, longitude: 12.5683, role: 'Danish constitutional and security-policy reference point' },
                { label: 'Brussels', latitude: 50.8503, longitude: 4.3517, role: 'NATO and European partnership reference point' },
                { label: 'Washington, DC', latitude: 38.9072, longitude: -77.0369, role: 'United States strategic and mineral-partnership reference point' },
            ],
        },
        sources: [
            {
                title: 'Trump: Tilbagetrækning af styrker i Europa afhænger af Grønland',
                publisher: 'KNR',
                publishedAt: '2026-07-09',
                url: 'https://www.knr.gl/da/nyheder/trump-tilbagetraekning-af-styrker-i-europa-afhaenger-af-groenland',
                perspectiveType: 'local',
                perspective: 'KNR publication of syndicated Ritzau reporting that directly quotes Greenland\'s prime minister on renewed outside pressure',
                supports: 'Greenland\'s attributed position on territorial integrity, international law, self-determination, and external demands for control',
            },
            {
                title: 'Greenland Mineral Resources Strategy 2025–2029',
                publisher: 'Mineral Resources Authority, Government of Greenland',
                publishedAt: '2025-01-31',
                url: 'https://govmin.gl/publications/greenland-mineral-resources-strategy-2025-2029/',
                perspectiveType: 'institutional',
                perspective: 'Official Greenlandic mineral-development strategy',
                supports: 'Government priorities for local benefit, sustainability, investment, and strategic partnerships',
            },
            {
                title: 'Greenland mineral policy – changes in procedures for exploitation licences',
                publisher: 'The Polar Journal',
                publishedAt: '2026-03-05',
                url: 'https://www.tandfonline.com/doi/full/10.1080/2154896X.2026.2628474',
                perspectiveType: 'independent',
                perspective: 'Independent research on mineral governance, licensing, and economic autonomy',
                supports: 'How resource rules connect commercial uncertainty, environmental review, and aspirations for greater autonomy',
            },
        ],
        supplementalSources: [
            {
                title: 'Greenland’s prime minister tells Trump’s envoy self-determination cannot be negotiated',
                publisher: 'Associated Press',
                publishedAt: '2026-05-18',
                url: 'https://apnews.com/article/bbece2f899116788fe45525dcfe7d030',
                perspective: 'Earlier independent reporting from Nuuk on Greenlandic consent and self-determination in external security relationships',
            },
            {
                title: 'The Danish Armed Forces expand their presence and continue exercises in Greenland in close cooperation with allies',
                publisher: 'Naalakkersuisut, Government of Greenland',
                publishedAt: '2026-01-14',
                url: 'https://naalakkersuisut.gl/Nyheder/2026/01/1401_forsvaret?sc_lang=da',
                perspective: 'Official Greenlandic and Danish account of expanded allied security activity',
            },
            {
                title: 'Section 21 Commission constitutes itself and begins its work',
                publisher: 'Naalakkersuisut, Government of Greenland',
                publishedAt: '2026-03-19',
                url: 'https://naalakkersuisut.gl/Nyheder/2026/03/1903_kommission?sc_lang=da',
                perspective: 'Official Greenlandic account of the legal study concerning a possible independence process',
            },
        ],
        waypoints: [
            {
                nodeId: 'Europe',
                title: 'Self-Determination Under Pressure',
                perspectiveLabel: 'Greenlandic prime minister in KNR',
                perspectiveType: 'local',
                narration: 'In July 2026, Greenland\'s prime minister said the island was not for sale and called for respect for territorial integrity, international law, and Greenlandic self-determination.',
                focusQuestion: 'How can a self-governing territory preserve democratic agency when larger powers frame it as a strategic asset?',
            },
            {
                nodeId: 'TechAIHub',
                title: 'Critical-Mineral Demand',
                perspectiveLabel: 'Government mineral strategy and independent research',
                perspectiveType: 'synthesis',
                narration: 'Greenland\'s strategy places sustainability, community involvement, local benefit, and information alongside critical-mineral investment and green-transition supply chains.',
                focusQuestion: 'Can mineral development support a green transition without reproducing extractive dependency?',
            },
            {
                nodeId: 'USA',
                title: 'External Partnerships',
                perspectiveLabel: 'Greenlandic partnership strategy',
                perspectiveType: 'institutional',
                narration: 'Greenland\'s strategy records mineral cooperation with the United States and a sustainable-value-chain partnership with the European Union.',
                focusQuestion: 'How can Greenland use competition among partners to increase its own bargaining power?',
            },
            {
                nodeId: 'NATO',
                title: 'A More Strategic Arctic',
                perspectiveLabel: 'Greenland, Denmark, and NATO allies',
                perspectiveType: 'institutional',
                narration: 'Greenland and Denmark announced that expanded 2026 exercise activity with NATO allies could include protecting critical infrastructure and other Arctic operations.',
                focusQuestion: 'How can stronger deterrence be reconciled with local participation and a preference for regional stability?',
            },
            {
                nodeId: 'Europe',
                title: 'The Independence Question',
                perspectiveLabel: 'Section 21 Commission',
                perspectiveType: 'institutional',
                narration: 'The Section 21 Commission held its constituting meeting on 18 March 2026 and began a legal study of what a process toward an independent Greenland would require.',
                focusQuestion: 'How do economic capacity, security guarantees, and democratic consent shape meaningful self-determination?',
            },
        ],
    },
    {
        id: 'eu-ai-act-transparency-implementation',
        title: 'EU AI Act: Transparency and a Revised Implementation Timeline',
        subtitle: 'AI-generated content rules take effect as high-risk deadlines move',
        regionTags: ['Europe', 'European Union'],
        issueDimensions: ['AI governance', 'Information integrity', 'Regulatory implementation', 'Fundamental rights'],
        actors: ['European Commission and EU AI Office', 'EU member-state authorities', 'AI providers and deployers', 'People interacting with AI systems'],
        nexusNodeIds: ['Europe', 'TechAIHub'],
        statusSummary: 'The EU AI Act reached its general application date on 2 August 2026. Transparency duties now cover specified interactions with AI and the marking or labelling of certain AI-generated or manipulated content. The AI Omnibus, which the European Commission says entered into force on 27 July 2026, moved the main high-risk-system deadline to 2 December 2027 and the deadline for AI embedded in regulated products to 2 August 2028.',
        whyItMatters: 'The case separates political claims about “AI regulation” into concrete duties, voluntary implementation tools, delayed high-risk rules, and questions about whether users can recognize synthetic content in practice.',
        updatedAt: '2026-08-03',
        confidence: 'high',
        uncertainty: 'Implementation guidance, standards, enforcement practice, and the list of code signatories can continue to change. The general application date does not mean every obligation has the same start date, and the voluntary transparency code is not itself the statutory rule.',
        coordinates: { latitude: 50.8503, longitude: 4.3517 },
        broadCategory: 'Technology & Innovation',
        sources: [
            {
                title: 'EU adopts the AI Omnibus: what it means for consumers',
                publisher: 'BEUC, The European Consumer Organisation',
                publishedAt: '2026-06-29',
                url: 'https://www.beuc.eu/news/eu-adopts-ai-omnibus-what-it-means-consumers',
                perspectiveType: 'local',
                perspective: 'Consumer and fundamental-rights perspective on delayed safeguards and transparency',
                supports: 'How the revised timetable may affect people subject to high-risk AI decisions',
            },
            {
                title: 'Commission publishes guidelines on transparency obligations for providers and deployers of certain AI systems',
                publisher: 'European Commission',
                publishedAt: '2026-07-20',
                url: 'https://digital-strategy.ec.europa.eu/en/news/commission-publishes-guidelines-transparency-obligations-providers-and-deployers-certain-ai-systems',
                perspectiveType: 'institutional',
                perspective: 'Official implementation guidance for Article 50 transparency duties applying from 2 August 2026',
                supports: 'Which disclosure and content-marking duties apply to providers and deployers',
            },
            {
                title: 'Three things you need to know about the new EU AI Act rules',
                publisher: 'ITPro',
                publishedAt: '2026-08-03',
                url: 'https://www.itpro.com/business/policy-and-legislation/three-things-you-need-to-know-about-the-new-eu-ai-act-rules',
                perspectiveType: 'independent',
                perspective: 'Independent implementation reporting for organizations and technology users',
                supports: 'The practical split between current transparency duties and delayed high-risk obligations',
            },
        ],
        supplementalSources: [
            {
                title: 'Regulation (EU) 2024/1689 (Artificial Intelligence Act)',
                publisher: 'EUR-Lex, European Union',
                publishedAt: '2024-07-12',
                url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en',
                perspective: 'Official legal text and staged application framework',
            },
            {
                title: 'AI Omnibus enters into force',
                publisher: 'European Commission',
                publishedAt: '2026-07-27',
                url: 'https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force',
                perspective: 'Official summary of revised high-risk deadlines and governance changes',
            },
        ],
        waypoints: [
            {
                nodeId: 'Europe',
                title: 'A Staged Rulebook',
                narration: 'The AI Act uses different application dates: some rules applied in 2025, transparency duties apply from 2 August 2026, and high-risk-system deadlines now fall later.',
                focusQuestion: 'Why can saying a law is “in force” obscure which duties actually apply today?',
            },
            {
                nodeId: 'TechAIHub',
                title: 'Recognizing Synthetic Content',
                narration: 'Article 50 transparency duties cover specified AI interactions and machine-readable marking or visible labelling for defined categories of generated or manipulated content.',
                focusQuestion: 'When does a label improve informed choice, and when might it become background noise?',
            },
            {
                nodeId: 'Europe',
                title: 'Deadlines Recalibrated',
                narration: 'The Commission says the AI Omnibus moved the main high-risk-system deadline to December 2027 and the product-embedded deadline to August 2028.',
                focusQuestion: 'How should governments balance implementation readiness against the cost of delaying safeguards?',
            },
            {
                nodeId: 'TechAIHub',
                title: 'From Text to Enforcement',
                narration: 'Guidelines and voluntary codes can support compliance, but enforcement practice, technical standards, and user understanding will shape real-world effects.',
                focusQuestion: 'Which evidence would show that transparency rules change provider behavior or public understanding?',
            },
        ],
    },
];

const addDays = (date, days) => {
    const [year, month, day] = date.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day + days));
    return result.toISOString().slice(0, 10);
};

const BROAD_CATEGORY_ALIASES = {
    'Technology & Innovation': 'Technology & Science',
    'Climate, Resources & Security': 'Environment & Energy',
    'Global Governance & Economics': 'Economy & Trade',
    'Technology & Economics': 'Economy & Trade',
};

const COVERAGE_REGION_ALIASES = {
    'Sub-Saharan Africa': 'Africa',
    'Horn of Africa and Red Sea': 'Africa',
    'Southern Africa': 'Africa',
    'North Africa': 'Middle East & North Africa',
    'North Africa and Mediterranean': 'Middle East & North Africa',
    'Middle East': 'Middle East & North Africa',
    'Middle East and Red Sea': 'Middle East & North Africa',
    'South Asia': 'Asia',
    'Central Asia': 'Asia',
    'East Asia': 'Asia',
    'Southeast Asia': 'Asia',
    'Asia-Pacific': 'Asia',
    'Latin America': 'Latin America & Caribbean',
    'Caribbean & Americas': 'Latin America & Caribbean',
    'Amazon Basin & South America': 'Latin America & Caribbean',
    'United States–Mexico Borderlands': 'North America',
    'Eastern Europe & Eurasia': 'Europe',
    'Global Oceans': 'Global',
};

const getSourceDateLabel = source => {
    if (source.publishedAt) return source.publishedAt;

    const timing = [];
    if (source.dataThrough) timing.push(`Data through ${source.dataThrough}`);
    else if (source.updatedAt) timing.push(`Updated ${source.updatedAt}`);
    else if (source.milestoneDate) timing.push(`${source.milestoneLabel || 'Milestone'} ${source.milestoneDate}`);
    if (source.reviewedAt) timing.push(`Living reference reviewed ${source.reviewedAt}`);

    return timing.join(' · ') || (source.sourceType === 'living-reference' ? 'Living reference' : 'Publication date not stated');
};

const normalizeCaseStudy = caseStudy => {
    const sourcePerspectiveTypes = ['local', 'institutional', 'independent'];
    const validSensitivity = ['standard', 'high'].includes(caseStudy.sensitivity);
    const reviewCadenceDays = caseStudy.reviewCadenceDays
        || (/conflict|displacement|security|sovereignty/i.test(caseStudy.issueDimensions.join(' ')) ? 30 : 90);
    const sensitivity = validSensitivity
        ? caseStudy.sensitivity
        : reviewCadenceDays <= 30 ? 'high' : 'standard';
    const fallbackLocation = caseStudy.coordinates ? [{
        label: caseStudy.regionTags[0],
        latitude: caseStudy.coordinates.latitude,
        longitude: caseStudy.coordinates.longitude,
    }] : [];
    const map = caseStudy.map || { mode: 'point', locations: fallbackLocation };

    const coverageRegion = caseStudy.coverageRegion || caseStudy.regionTags[0];

    return {
        ...caseStudy,
        broadCategory: BROAD_CATEGORY_ALIASES[caseStudy.broadCategory] || caseStudy.broadCategory,
        coverageRegion: COVERAGE_REGION_ALIASES[coverageRegion] || coverageRegion,
        featured: Boolean(caseStudy.featured),
        sensitivity,
        editorialCaution: caseStudy.editorialCaution
            || (!validSensitivity && typeof caseStudy.sensitivity === 'string' ? caseStudy.sensitivity : '')
            || caseStudy.uncertainty,
        reviewCadenceDays,
        reviewBy: caseStudy.reviewBy || addDays(caseStudy.updatedAt, reviewCadenceDays),
        map: {
            ...map,
            locations: map.locations.map(location => ({ ...location })),
        },
        sources: caseStudy.sources.map((source, index) => ({
            ...source,
            perspectiveType: source.perspectiveType || sourcePerspectiveTypes[index],
            dateLabel: getSourceDateLabel(source),
            supports: Array.isArray(source.supports)
                ? source.supports.join(' ')
                : source.supports || source.perspective,
        })),
        supplementalSources: (caseStudy.supplementalSources || []).map(source => ({
            ...source,
            dateLabel: getSourceDateLabel(source),
        })),
        waypoints: caseStudy.waypoints.map((waypoint, index) => ({
            ...waypoint,
            perspectiveLabel: waypoint.perspectiveLabel || waypoint.title,
            perspectiveType: waypoint.perspectiveType || (index === caseStudy.waypoints.length - 1 ? 'synthesis' : sourcePerspectiveTypes[index % sourcePerspectiveTypes.length]),
        })),
    };
};

export const CASE_STUDIES_2026 = [
    ...CORE_CASE_STUDIES_2026,
    ...AFRICA_MENA_CASE_STUDIES_2026,
    ...ASIA_PACIFIC_CASE_STUDIES_2026,
    ...AMERICAS_GLOBAL_CASE_STUDIES_2026,
].map(normalizeCaseStudy);

/**
 * Adapt a canonical case study to the legacy forecast record shape while
 * retaining evidence metadata for source-aware consumers.
 */
export function toForecastRecord(caseStudy) {
    if (!caseStudy || typeof caseStudy !== 'object') {
        throw new TypeError('toForecastRecord requires a case-study object');
    }

    const primarySource = caseStudy.sources?.[0];
    const sourceLabel = (caseStudy.sources || [])
        .map(source => `${source.publisher}: ${source.title}${source.dateLabel ? ` (${source.dateLabel})` : ''}`)
        .join('; ');
    const mapAnchor = caseStudy.coordinates || caseStudy.map?.locations?.[0];

    if (!mapAnchor || !Number.isFinite(Number(mapAnchor.latitude)) || !Number.isFinite(Number(mapAnchor.longitude))) {
        throw new TypeError(`Case study ${caseStudy.id || '(unknown)'} requires at least one valid map location`);
    }

    return {
        'Topic/Sector': caseStudy.issueDimensions.join(' / '),
        'Entity/Subject': caseStudy.title,
        'Key Player/Organization': caseStudy.actors.join(', '),
        Timeline: `Current as of ${caseStudy.updatedAt}`,
        'Expected Impact/Value': `${caseStudy.statusSummary} ${caseStudy.whyItMatters}`,
        Source: sourceLabel,
        url: primarySource?.url || '',
        Latitude: String(mapAnchor.latitude),
        Longitude: String(mapAnchor.longitude),
        Broad_Category: caseStudy.broadCategory,
        caseStudyId: caseStudy.id,
        statusSummary: caseStudy.statusSummary,
        whyItMatters: caseStudy.whyItMatters,
        issueDimensions: [...caseStudy.issueDimensions],
        regionTags: [...caseStudy.regionTags],
        nexusActorIds: [...caseStudy.nexusNodeIds],
        updatedAt: caseStudy.updatedAt,
        confidence: caseStudy.confidence,
        uncertainty: caseStudy.uncertainty,
        coverageRegion: caseStudy.coverageRegion,
        featured: caseStudy.featured,
        sensitivity: caseStudy.sensitivity,
        editorialCaution: caseStudy.editorialCaution,
        reviewCadenceDays: caseStudy.reviewCadenceDays,
        reviewBy: caseStudy.reviewBy,
        map: {
            ...caseStudy.map,
            locations: caseStudy.map.locations.map(location => ({ ...location })),
        },
        sources: caseStudy.sources.map(source => ({ ...source })),
        supplementalSources: caseStudy.supplementalSources.map(source => ({ ...source })),
        waypoints: caseStudy.waypoints.map(waypoint => ({ ...waypoint })),
        isCaseStudy: true,
        isEditorial: true,
    };
}

export default CASE_STUDIES_2026;

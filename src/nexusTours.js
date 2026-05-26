/**
 * nexusTours.js — Guided tour data for the Relations Nexus
 */
export const GUIDED_TOURS = [
    {
        id: 'semiconductor', title: '🔬 Semiconductor Supply Chain',
        subtitle: 'Follow the global chip chokepoint from sand to silicon', color: '#bf55ec',
        waypoints: [
            { nodeId: 'TechAIHub', title: 'The Silicon Nexus', narration: 'The global semiconductor industry is concentrated in a handful of critical nodes. TSMC in Taiwan produces over 90% of advanced chips. ASML in the Netherlands is the sole maker of EUV lithography machines. Nvidia designs the AI accelerators powering the revolution.', duration: 8000, highlightLinks: ['tech','trade'] },
            { nodeId: 'AsiaPacific', title: 'Asia-Pacific Foundries', narration: "Taiwan's TSMC and South Korea's Samsung are the world's only advanced chip foundries. A Chinese invasion of Taiwan would paralyze the global technology supply chain — a geopolitical chokepoint with no historical parallel.", duration: 8000, highlightLinks: ['tech'] },
            { nodeId: 'USA', title: 'American Design & Control', narration: 'The US dominates chip design (Nvidia, Qualcomm, AMD) and controls export regulations. The CHIPS Act allocates $52B to onshore manufacturing. Export controls aim to maintain a "generational lead" in AI hardware.', duration: 8000, highlightLinks: ['tech','conflict'] },
            { nodeId: 'Europe', title: 'European Bottleneck: ASML', narration: "The Netherlands' ASML is the sole supplier of EUV lithography systems — each $380M. Without ASML machines, no nation can manufacture advanced chips. A small Dutch company is a linchpin of global power.", duration: 8000, highlightLinks: ['tech','trade'] },
            { nodeId: 'China', title: "China's Chip Ambitions", narration: "Despite $150B+ in subsidies, China remains 5–10 years behind. Huawei's Kirin chip showed surprising progress, but sustained advancement requires equipment China cannot access due to US-led export controls.", duration: 8000, highlightLinks: ['conflict','tech'] },
        ],
    },
    {
        id: 'sudan', title: '⚔ Sudan Conflict Network',
        subtitle: 'Trace the deadliest war the world forgot', color: '#ff0066',
        waypoints: [
            { nodeId: 'MilitantPMC', title: 'Non-State Actors & PMCs', narration: "The RSF — born from the Janjaweed militia — launched war against Sudan's army in April 2023. Wagner Group mercenaries provide weapons and training, creating a proxy conflict with global dimensions.", duration: 8000, highlightLinks: ['conflict'] },
            { nodeId: 'Africa', title: 'African Union & Regional Crisis', narration: "Over 12 million Sudanese displaced — the world's largest displacement crisis. The African Union struggles to mediate while neighboring Chad, Egypt, and Ethiopia face massive refugee flows destabilizing the Sahel.", duration: 8000, highlightLinks: ['conflict','diplomacy'] },
            { nodeId: 'Russia', title: "Russia's Shadow Influence", narration: "Wagner's involvement connects to Russia's broader Africa strategy: gold mining concessions, military base negotiations at Port Sudan, and arms transfers. Moscow gains strategic depth while the West focuses on Ukraine.", duration: 8000, highlightLinks: ['conflict','trade'] },
            { nodeId: 'UN_OPEC', title: 'Multilateral Paralysis', narration: "The UN Security Council remains deadlocked — Russia and China block action. Humanitarian agencies report potential genocide in Darfur. The international community's response: 'catastrophically inadequate.'", duration: 8000, highlightLinks: ['diplomacy'] },
            { nodeId: 'MiddleEast', title: 'Gulf State Involvement', narration: "UAE accused of funneling weapons to the RSF through Chad. Saudi Arabia and Egypt back the Sudanese army. The conflict has become a proxy battleground for competing Middle Eastern interests in the Horn of Africa.", duration: 8000, highlightLinks: ['conflict','trade'] },
        ],
    },
    {
        id: 'us-china', title: '🐉 US-China Strategic Competition',
        subtitle: 'The defining great power rivalry of the 21st century', color: '#ff9900',
        waypoints: [
            { nodeId: 'USA', title: 'American Primacy Under Pressure', narration: "The US maintains the world's largest military, reserve currency, and technology sector. But relative power is shifting. The Indo-Pacific strategy aims to maintain the US-led order against China's rise.", duration: 8000, highlightLinks: ['conflict','trade','diplomacy'] },
            { nodeId: 'China', title: "China's Comprehensive Power", narration: "China's GDP (PPP) rivals the US. Belt & Road spans 150+ countries. Military modernization targets Taiwan reunification by 2027. 'Dual circulation' aims for technological self-sufficiency.", duration: 8000, highlightLinks: ['trade','tech','conflict'] },
            { nodeId: 'AsiaPacific', title: 'The Indo-Pacific Theatre', narration: "Taiwan, South China Sea, Korean Peninsula — flashpoints. AUKUS, the Quad, bilateral alliances with Japan and Philippines form America's containment architecture. China calls it 'Cold War mentality.'", duration: 8000, highlightLinks: ['conflict','diplomacy'] },
            { nodeId: 'TechAIHub', title: 'The Technology War', narration: "Semiconductors, AI, quantum — technology supremacy is the new arms race. Export controls and investment screening have 'decoupled' the tech ecosystems of the world's two largest economies.", duration: 8000, highlightLinks: ['tech','trade'] },
            { nodeId: 'NATO', title: 'Alliance Systems', narration: "NATO's 2022 Strategic Concept named China a 'systemic challenge' for the first time. The China-Russia 'no limits' partnership positions two nuclear powers against the Western alliance — a structural shift not seen since 1945.", duration: 8000, highlightLinks: ['diplomacy','conflict'] },
        ],
    },
    {
        id: 'energy', title: '⚡ Energy Geopolitics',
        subtitle: 'Oil, gas, and the weaponization of energy', color: '#ff6600',
        waypoints: [
            { nodeId: 'MiddleEast', title: 'The Persian Gulf Engine', narration: "The Middle East holds 48% of proven oil reserves. Saudi Arabia, UAE, Iraq, and Iran together control the marginal barrel — the price-setting capacity that shapes global inflation and geopolitical leverage.", duration: 8000, highlightLinks: ['trade'] },
            { nodeId: 'UN_OPEC', title: 'OPEC+ and Energy Governance', narration: "OPEC+ (including Russia) manages 40% of global oil production. Production cuts kept prices elevated. The cartel's cohesion is tested by US shale, renewables, and member state rivalries.", duration: 8000, highlightLinks: ['trade','diplomacy'] },
            { nodeId: 'Russia', title: "Russia's Energy Weapon", narration: "Russia weaponized gas to Europe after invading Ukraine. Nord Stream's destruction and the pivot to Asian buyers rewired global energy flows. Europe's dependency became a strategic vulnerability.", duration: 8000, highlightLinks: ['trade','conflict'] },
            { nodeId: 'Europe', title: "Europe's Energy Transition", narration: "Europe's scramble away from Russian gas accelerated LNG imports, renewables, and nuclear reconsideration. Energy security and climate policy collided — the EU's Green Deal doubles as strategic autonomy.", duration: 8000, highlightLinks: ['trade','diplomacy'] },
            { nodeId: 'Africa', title: "Africa's Energy Frontier", narration: "Mozambique's gas, Nigeria's oil, Congo's cobalt, Sahel uranium — Africa holds critical energy resources but captures little value. Chinese and Russian investment competes with Western ESG-constrained capital.", duration: 8000, highlightLinks: ['trade','tech'] },
        ],
    },
];

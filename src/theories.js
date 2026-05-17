/**
 * theories.js — 9 IR Theory Lenses with Philosopher Citations
 * Each theory includes: color, description, key thinkers, seminal works,
 * and category-specific event interpretations.
 */

export const theories = {
    Realism: {
        color: '#ff4d4d',
        description: 'Focuses on power, national interest, and the anarchic nature of the international system.',
        thinkers: [
            { name: 'Thucydides', work: 'The Melian Dialogue', insight: 'The strong do what they can; the weak suffer what they must.' },
            { name: 'Niccolò Machiavelli', work: 'The Prince (1532)', insight: 'It is better to be feared than loved, if one cannot be both.' },
            { name: 'Thomas Hobbes', work: 'Leviathan (1651)', insight: 'Life in the state of nature is solitary, poor, nasty, brutish, and short.' },
            { name: 'Hans Morgenthau', work: 'Politics Among Nations (1948)', insight: 'International politics is a struggle for power.' },
            { name: 'John Mearsheimer', work: 'The Tragedy of Great Power Politics (2001)', insight: 'Great powers are always searching for opportunities to gain power over rivals.' },
            { name: 'Kenneth Waltz', work: 'Theory of International Politics (1979)', insight: 'The structure of the international system — anarchy — determines state behavior.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the key actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `"${entity}" is fundamentally about state survival and the balance of power. ${players} are acting out of rational self-interest in an anarchic system where no higher authority can enforce rules. ${impact ? `The expected outcome — ${impact.substring(0, 120)} — reflects states maximizing their relative power.` : ''} As Thucydides observed: "The strong do what they can; the weak suffer what they must."`;
            if (category.includes('Economy') || category.includes('Trade'))
                return `A realist sees "${entity}" as economic statecraft — a tool of national power. ${players} leverage trade and finance not for mutual benefit, but to increase relative power over rivals. As Morgenthau argued, all politics is ultimately a struggle for power — economics included.`;
            if (category.includes('Technology'))
                return `"${entity}" represents a critical arena for technological supremacy. For realists, ${players}'s pursuit of technological advantage is inseparable from military dominance. Mearsheimer would note that whoever controls this space gains a decisive edge in the international system.`;
            if (category.includes('Environment') || category.includes('Energy'))
                return `A realist views "${entity}" through resource competition. ${players} are driven by energy security, not altruism. Environmental agreements are only adhered to when they serve the national interest. States will defect when compliance threatens their relative power.`;
            if (category.includes('Health') || category.includes('Society'))
                return `Realists argue "${entity}" is secondary to 'high politics' of security and power. ${players} engage in health diplomacy only when it serves strategic interests — vaccine diplomacy is soft power competition. Humanitarian concerns are instrumentalized.`;
            return `In the realist view, "${entity}" involving ${players} ultimately comes down to power politics. States pursue their national interest regardless of norms or institutions.`;
        }
    },
    Liberalism: {
        color: '#3399ff',
        description: 'Emphasizes international cooperation, institutions, and the importance of democracy and human rights.',
        thinkers: [
            { name: 'Immanuel Kant', work: 'Perpetual Peace (1795)', insight: 'Democratic republics will tend toward peace with each other.' },
            { name: 'John Locke', work: 'Two Treatises of Government (1689)', insight: 'Governments derive legitimacy from the consent of the governed.' },
            { name: 'Woodrow Wilson', work: 'Fourteen Points (1918)', insight: 'Open covenants, openly arrived at — collective security through international organization.' },
            { name: 'Robert Keohane & Joseph Nye', work: 'Power and Interdependence (1977)', insight: 'Complex interdependence makes military force less useful between states.' },
            { name: 'Francis Fukuyama', work: 'The End of History (1992)', insight: 'Liberal democracy represents the endpoint of ideological evolution.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the key actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `A liberal analysis sees "${entity}" as a failure of institutional mechanisms. ${players} should channel this dispute through multilateral frameworks — the UN, regional organizations, or international courts. ${impact ? `The expected impact (${impact.substring(0, 120)}) could be mitigated through collective security and diplomatic engagement.` : ''} Kant's democratic peace theory suggests promoting democratic governance reduces such conflicts.`;
            if (category.includes('Economy') || category.includes('Trade'))
                return `Liberals view "${entity}" through complex interdependence (Keohane & Nye). ${players} are embedded in economic relationships where cooperation produces mutual gains. Free trade governed by transparent rules — WTO, IMF, bilateral agreements — benefits all parties.`;
            if (category.includes('Technology'))
                return `A liberal perspective on "${entity}" emphasizes international norms and governance frameworks. ${players} should collaborate on standard-setting, data protection, and ethical guidelines. No single state can regulate global digital flows alone.`;
            if (category.includes('Environment') || category.includes('Energy'))
                return `Liberals see "${entity}" as a collective action problem requiring institutional solutions. ${players} must work through frameworks like the Paris Agreement and UNFCCC. No state can solve climate change alone — international cooperation is existential.`;
            if (category.includes('Health') || category.includes('Society'))
                return `A liberal analysis of "${entity}" highlights international institutions (WHO, UNICEF, MSF) and human rights norms. ${players} should strengthen global health governance. Health is a global public good requiring collective action.`;
            return `Liberals argue "${entity}" demonstrates the need for stronger international institutions. ${players} should pursue cooperation through established norms. Mutual gains are possible when states commit to transparency and shared rules.`;
        }
    },
    Marxism: {
        color: '#cc0000',
        description: 'Analyzes events through class struggle, exploitation, and the contradictions of global capitalism.',
        thinkers: [
            { name: 'Karl Marx & Friedrich Engels', work: 'The Communist Manifesto (1848)', insight: 'The history of all hitherto existing society is the history of class struggles.' },
            { name: 'Vladimir Lenin', work: 'Imperialism: The Highest Stage of Capitalism (1917)', insight: 'Imperialism is capitalism at that stage of development where monopolies and finance capital dominate.' },
            { name: 'Antonio Gramsci', work: 'Prison Notebooks (1930s)', insight: 'Cultural hegemony — the ruling class maintains power through ideological control, not just force.' },
            { name: 'Immanuel Wallerstein', work: 'The Modern World-System (1974)', insight: 'The global economy is a single capitalist world-system with core, semi-periphery, and periphery.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the actors involved';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Economy') || category.includes('Trade') || impact.includes('$'))
                return `"${entity}" exposes the contradictions of global capitalism. ${players} serve capital accumulation, not workers. ${impact ? `When we read "${impact.substring(0, 120)}," we must ask: who profits, and whose labor is exploited?` : ''} As Marx wrote: the history of all society is the history of class struggles. The Global South bears the heaviest burden.`;
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `A Marxist analysis reveals that ${players} are driven by material and economic interests, not ideology. As Lenin argued, wars serve the interests of finance capital and the military-industrial complex. Follow the money — who benefits from escalation?`;
            if (category.includes('Technology'))
                return `"${entity}" must be analyzed in terms of who owns the means of technological production. ${players} accumulate technological capital that deepens class divisions — automating labor, concentrating wealth, extending surveillance. Gramsci would call this technological hegemony.`;
            if (category.includes('Environment') || category.includes('Energy'))
                return `Environmental destruction in "${entity}" is inherent to capitalism's logic of endless accumulation. ${players} treat nature as a free resource to exploit. Climate change is the market working as designed, externalizing costs onto the poorest.`;
            return `"${entity}" reflects structural inequalities built into the capitalist world-system. ${players}'s actions reinforce a global division of labor that enriches the core at the expense of the periphery.`;
        }
    },
    Structuralism: {
        color: '#9966ff',
        description: 'Examines how the global Core-Periphery hierarchy constrains state behavior and development.',
        thinkers: [
            { name: 'Raúl Prebisch', work: 'The Economic Development of Latin America (1950)', insight: 'Terms of trade systematically disadvantage raw-material exporters.' },
            { name: 'André Gunder Frank', work: 'The Development of Underdevelopment (1966)', insight: 'Underdevelopment is not a stage — it is actively produced by the world capitalist system.' },
            { name: 'Immanuel Wallerstein', work: 'The Modern World-System (1974)', insight: 'Core states exploit periphery states through unequal exchange in a single world-economy.' },
            { name: 'Samir Amin', work: 'Accumulation on a World Scale (1974)', insight: 'Peripheral capitalism is structurally dependent on — and subordinate to — core capitalism.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this development';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Economy') || category.includes('Trade'))
                return `"${entity}" must be analyzed through the Core-Periphery model (Prebisch, Frank). ${players} operate within a hierarchy where Core states control capital and terms of trade, while Periphery states export raw materials. ${impact ? `The outcome — ${impact.substring(0, 120)} — will deepen structural dependency.` : ''} Unequal exchange is built into the system.`;
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `A structuralist reading reveals how Core states use military power to maintain the global hierarchy. ${players} operate where peripheral states have little autonomy — their foreign policies constrained by dependency on Core military protection and economic aid. Conflict in the periphery serves Core interests.`;
            if (category.includes('Technology'))
                return `"${entity}" illustrates the technological dependency trap. ${players} from Core states control patents and R&D while Periphery states import technology on unfavorable terms. Without genuine technology transfer, the structural hierarchy deepens.`;
            if (category.includes('Environment') || category.includes('Energy'))
                return `Environmental degradation in "${entity}" flows from Core exploitation of Periphery resources. ${players} perpetuate a system where the Global South bears ecological costs of Northern consumption — extractive industries, monoculture, and toxic waste dumping follow the Core-Periphery divide.`;
            return `"${entity}" must be understood within the Core-Periphery structure. ${players} operate in a hierarchy where Core states set the rules, and Periphery states are structurally dependent. True change requires restructuring the entire system (Frank, Amin).`;
        }
    },
    Constructivism: {
        color: '#00cc99',
        description: 'Argues that global politics is shaped by socially constructed ideas, identities, and norms.',
        thinkers: [
            { name: 'Alexander Wendt', work: 'Social Theory of International Politics (1999)', insight: '"Anarchy is what states make of it" — the international system has no inherent logic; states construct it through practice.' },
            { name: 'Martha Finnemore', work: 'National Interests in International Society (1996)', insight: 'States\' interests are not given — they are taught by international organizations and norms.' },
            { name: 'Benedict Anderson', work: 'Imagined Communities (1983)', insight: 'Nations are socially constructed communities — imagined because members will never meet most fellow members.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this event';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `A constructivist asks: how are identities and norms shaping "${entity}"? As Wendt argues, "anarchy is what states make of it." The labels used — 'terrorist,' 'ally,' 'threat' — construct the reality we respond to. ${players} are not responding to objective threats but to socially constructed ones. War is not inevitable; it is a choice shaped by how we define 'us' and 'them.'`;
            if (category.includes('Culture') || category.includes('Society'))
                return `"${entity}" is fundamentally about identity construction (Anderson). ${players} are engaged in defining who belongs and who doesn't — these are not natural categories but social constructions. As Finnemore shows, even 'national interests' are taught, not given.`;
            return `A constructivist asks: how are identities and norms shaping "${entity}"? The way ${players} frame this issue actively constructs reality. ${impact ? `The projected impact (${impact.substring(0, 100)}) is not inevitable; it depends on whether current narratives hold or new ideas reshape interests.` : ''} Change is possible when shared beliefs shift (Wendt).`;
        }
    },
    Feminism: {
        color: '#ff66cc',
        description: 'Examines how gender hierarchies shape global power dynamics and whose voices are excluded.',
        thinkers: [
            { name: 'Cynthia Enloe', work: 'Bananas, Beaches and Bases (1989)', insight: 'International politics is deeply gendered — women\u2019s labor sustains the global system but is rendered invisible.' },
            { name: 'J. Ann Tickner', work: 'Gender in International Relations (1992)', insight: 'Traditional IR theory reflects a masculinist worldview that equates security with military power.' },
            { name: 'bell hooks', work: 'Feminist Theory: From Margin to Center (1984)', insight: 'Feminism is a movement to end sexism, sexist exploitation, and oppression — for everyone.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the decision-makers';
            const impact = event['Expected Impact/Value'] || '';
            return `A feminist analysis of "${entity}" asks: where are the women, and whose security is prioritized? The key players — ${players} — overwhelmingly represent patriarchal power structures (Enloe). ${impact ? `When we consider the impact ("${impact.substring(0, 100)}"), we must ask how women, LGBTQ+ communities, and marginalized groups are disproportionately harmed — yet excluded from decisions.` : ''} As Tickner argues, security must be redefined beyond military terms to include human security: food, health, freedom from violence.`;
        }
    },
    Postcolonialism: {
        color: '#ff9933',
        description: 'Critically analyzes colonial legacies and how Western-centric power dynamics persist today.',
        thinkers: [
            { name: 'Edward Said', work: 'Orientalism (1978)', insight: 'The West constructed "the Orient" as an exotic, inferior Other to justify domination.' },
            { name: 'Frantz Fanon', work: 'The Wretched of the Earth (1961)', insight: 'Decolonization is always a violent phenomenon — the colonized must liberate both land and mind.' },
            { name: 'Gayatri Spivak', work: 'Can the Subaltern Speak? (1988)', insight: 'The most marginalized voices are systematically silenced by both colonial and postcolonial power structures.' },
            { name: 'Chinua Achebe', work: 'Things Fall Apart (1958)', insight: 'African societies had complex civilizations before colonialism — the colonial narrative erased them.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this event';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';
            return `A postcolonial reading of "${entity}" reveals the enduring legacy of imperialism (Fanon). Who counts as a 'key player' (${players}), whose perspective is centered — this reflects deep Eurocentric biases (Said). ${impact ? `The projected outcome ("${impact.substring(0, 100)}") ignores local agency and indigenous knowledge systems, imposing Western frameworks (Spivak).` : ''} We must decenter the Western gaze and amplify voices from the Global South.`;
        }
    },
    'Green Theory': {
        color: '#33cc33',
        description: 'Challenges the anthropocentric worldview — nature has intrinsic value, not just instrumental worth.',
        thinkers: [
            { name: 'Murray Bookchin', work: 'The Ecology of Freedom (1982)', insight: 'The domination of nature stems from the domination of human by human — social hierarchy produces ecological crisis.' },
            { name: 'Arne Næss', work: 'The Shallow and the Deep Ecology Movement (1973)', insight: 'Deep ecology insists that all living beings have intrinsic value regardless of their utility to humans.' },
            { name: 'Vandana Shiva', work: 'Staying Alive: Women, Ecology and Development (1988)', insight: 'The "development" model destroys both nature and women\u2019s livelihoods — eco-feminism links gender and environmental justice.' },
            { name: 'Rachel Carson', work: 'Silent Spring (1962)', insight: 'Pesticides devastate ecosystems — industrial progress without ecological awareness is self-destructive.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Environment') || category.includes('Energy'))
                return `Green theory places "${entity}" at the center of analysis, not the margins. ${players} operate within a growth-obsessed system that treats nature as an infinite resource. As Næss argues, all living beings have intrinsic value. ${impact ? `The impact ("${impact.substring(0, 100)}") must be measured not just in economic terms, but in biodiversity loss, ecosystem health, and intergenerational justice.` : ''} Shiva would add: who bears the ecological cost? Almost always the Global South and women.`;
            if (category.includes('Economy') || category.includes('Trade'))
                return `A green analysis of "${entity}" challenges the assumption that economic growth is always good. ${players} pursue GDP expansion at planetary cost. Bookchin argues that ecological crisis is rooted in social domination — capitalism's logic of endless accumulation is incompatible with a finite planet. We need degrowth, not green growth.`;
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `Green theorists connect "${entity}" to environmental security — resource wars, climate migration, and ecological collapse as drivers of conflict. ${players} fight over resources while the biosphere degrades. As Carson warned, industrial power without ecological awareness is self-destructive.`;
            return `Green theory asks: what is the ecological footprint of "${entity}"? ${players} make decisions within systems that externalize environmental costs. Nature is not a backdrop to politics — it is the foundation. Without healthy ecosystems, no economy, no state, no human security exists.`;
        }
    },
    'Critical Security': {
        color: '#ff6600',
        description: 'Asks "security for whom?" — challenges state-centric definitions and examines how threats are socially constructed.',
        thinkers: [
            { name: 'Barry Buzan', work: 'People, States and Fear (1983)', insight: 'Security has five sectors: military, political, economic, societal, and environmental.' },
            { name: 'Ole Wæver', work: 'Securitization Theory (1995)', insight: 'A "security threat" is not objective — it is created when political actors successfully frame an issue as existential.' },
            { name: 'Ken Booth', work: 'Theory of World Security (2007)', insight: 'True security means emancipation — freeing people from the structures that oppress them.' },
            { name: 'Amartya Sen', work: 'Development as Freedom (1999)', insight: 'Human security requires expanding real freedoms: health, education, political participation — not just military defense.' }
        ],
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this event';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';
            if (category.includes('Conflict') || category.includes('Geopolitics'))
                return `Critical Security Studies asks: whose security is "${entity}" really about? ${players} frame this as a state security issue, but Wæver's securitization theory shows that "threats" are constructed through political speech acts. Who benefits from calling this a security crisis? As Booth argues, true security is emancipation — freedom from the structures that cause insecurity in the first place.`;
            if (category.includes('Health') || category.includes('Society'))
                return `"${entity}" demonstrates Buzan's point that security has five sectors — this is societal/health security, not just military. ${players} often neglect human security (Sen) while over-investing in military capability. The real question is: are people free from want, fear, and indignity?`;
            if (category.includes('Technology'))
                return `A Critical Security lens on "${entity}" asks: who is being surveilled, and who is doing the surveilling? ${players} use technology to securitize — to frame issues as existential threats requiring emergency measures (Wæver). This often means expanding state power at the expense of civil liberties.`;
            return `Critical Security Studies challenges us to ask: security for whom? "${entity}" is framed by ${players} as a security issue, but Wæver shows this framing is a political choice. ${impact ? `The impact ("${impact.substring(0, 100)}") must be evaluated not through state survival, but through human emancipation (Booth, Sen).` : ''}`;
        }
    }
};

// Key Political Documents — reference for student research
export const KEY_DOCUMENTS = [
    { name: 'UN Charter (1945)', articles: 'Art. 1, 2, 39, 51', relevance: 'Foundation of international law — sovereignty, collective security, self-defense' },
    { name: 'Universal Declaration of Human Rights (1948)', articles: 'Art. 1-30', relevance: 'Normative baseline for all human rights discussions' },
    { name: 'Geneva Conventions (1949)', articles: 'I-IV + Protocols', relevance: 'Laws of armed conflict — protection of civilians, POWs' },
    { name: 'Nuclear Non-Proliferation Treaty (1968)', articles: 'Art. I-X', relevance: 'Nuclear disarmament and non-proliferation framework' },
    { name: 'Montevideo Convention (1933)', articles: 'Art. 1', relevance: 'Statehood criteria: population, territory, government, diplomatic capacity' },
    { name: 'Responsibility to Protect (R2P) (2005)', articles: 'UN World Summit', relevance: 'When is humanitarian intervention justified?' },
    { name: 'Paris Climate Agreement (2015)', articles: 'Art. 2, 4', relevance: 'Global temperature targets and nationally determined contributions' },
    { name: 'UN Sustainable Development Goals (2015)', articles: '17 Goals', relevance: 'Framework for evaluating development and poverty events' },
    { name: 'ICC Rome Statute (1998)', articles: 'Art. 5-8', relevance: 'International criminal justice — genocide, war crimes, crimes against humanity' },
    { name: 'Westphalian Model (1648)', articles: 'Treaty of Westphalia', relevance: 'Foundation of the sovereign state system — challenged by globalization' }
];

export const getTheoryInterpretation = (theoryName, event) => {
    const theory = theories[theoryName];
    if (!theory) return "Select a theory to view perspective.";
    return theory.getInterpretation(event);
};

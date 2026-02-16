/**
 * theories.js
 * Event-specific interpretations through International Relations lenses.
 * Each theory reads the event's actual data (topic, entity, key players, impact)
 * and constructs an analysis that directly references those details.
 */

export const theories = {
    Realism: {
        color: '#ff4d4d',
        description: 'Focuses on power, national interest, and the anarchic nature of the international system.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the key actors';
            const impact = event['Expected Impact/Value'] || '';
            const category = event.Broad_Category || '';

            if (category.includes('Conflict') || category.includes('Geopolitics')) {
                return `"${entity}" is fundamentally about state survival and the balance of power. ${players} are acting out of rational self-interest in an anarchic system where no higher authority can enforce rules. ${impact ? `The expected outcome — ${impact.substring(0, 120)} — reflects the inevitable consequence of states maximizing their relative power.` : ''} Trust between states is fragile; cooperation is temporary and strategic.`;
            }
            if (category.includes('Economy') || category.includes('Trade')) {
                return `A realist sees "${entity}" as economic statecraft — a tool of national power. ${players} are leveraging trade and finance not for mutual benefit, but to increase relative power over rivals. ${impact ? `The projected impact (${impact.substring(0, 100)}) will shift the balance of economic leverage between competing states.` : ''}`;
            }
            if (category.includes('Technology')) {
                return `"${entity}" represents a critical arena for technological supremacy. For realists, ${players}'s pursuit of technological advantage is inseparable from military and strategic dominance. Whoever controls this space gains a decisive edge in the international system.`;
            }
            return `In the realist view, "${entity}" involving ${players} ultimately comes down to power politics. States will pursue their national interest regardless of norms or institutions.`;
        }
    },
    Liberalism: {
        color: '#3399ff',
        description: 'Emphasizes international cooperation, institutions, and the importance of democracy and human rights.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the key actors';
            const impact = event['Expected Impact/Value'] || '';
            const source = event.Source || '';

            if (event.url || source) {
                return `A liberal lens highlights how "${entity}" creates opportunities for institutional cooperation. ${players} could leverage existing multilateral frameworks (UN, WTO, regional bodies) to manage this situation. ${impact ? `The expected impact — ${impact.substring(0, 120)} — could be mitigated through transparent international norms and collective agreements.` : ''} The fact that this is being reported and debated openly is itself a sign that democratic accountability and press freedom matter.`;
            }
            return `Liberals would argue that "${entity}" demonstrates the need for stronger international institutions. ${players} should pursue cooperation through established norms rather than unilateral action. Mutual gains are possible if states commit to transparency and shared rules.`;
        }
    },
    Marxism: {
        color: '#cc0000',
        description: 'Analyzes events through class struggle, exploitation, and the contradictions of global capitalism.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the actors involved';
            const impact = event['Expected Impact/Value'] || '';

            if (impact.includes('$') || event.Broad_Category?.includes('Economy')) {
                return `"${entity}" exposes the contradictions of global capitalism. The involvement of ${players} serves the interests of capital accumulation, not ordinary workers. ${impact ? `When we read "${impact.substring(0, 120)}," we must ask: who profits, and whose labor is being exploited?` : ''} The Global South bears the heaviest burden while transnational elites capture the gains.`;
            }
            if (event.Broad_Category?.includes('Conflict')) {
                return `A Marxist analysis of "${entity}" reveals that ${players} are driven not by ideology or security, but by underlying material and economic interests. Wars and conflicts serve the military-industrial complex and distract the working class from domestic exploitation. Follow the money — who benefits from escalation?`;
            }
            return `"${entity}" reflects the structural inequalities built into the capitalist world-system. ${players}'s actions reinforce a global division of labor that enriches the core at the expense of the periphery.`;
        }
    },
    Structuralism: {
        color: '#9966ff',
        description: 'Examines how the global Core-Periphery hierarchy constrains state behavior and development.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this development';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';

            return `"${entity}" must be understood within the global Core-Periphery structure. ${players} operate within a hierarchy where 'Core' states (wealthy, industrialized nations) set the rules, and 'Periphery' states are structurally dependent on them. ${impact ? `The expected outcome — ${impact.substring(0, 120)} — will likely reinforce existing dependencies rather than challenge the structural power of the Global North.` : ''} True change requires restructuring the entire system, not just adjusting policies within it.`;
        }
    },
    Constructivism: {
        color: '#00cc99',
        description: 'Argues that global politics is shaped by socially constructed ideas, identities, and norms.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this event';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';

            return `A constructivist asks: how are identities and norms shaping "${entity}"? The way ${players} frame this issue — the labels used ('terrorist,' 'ally,' 'threat,' 'partner') — actively constructs the reality we respond to. ${impact ? `The projected impact (${impact.substring(0, 100)}) is not inevitable; it depends on whether the current narrative holds or whether new ideas reshape how states see their interests and identities.` : ''} Change is possible when shared beliefs shift.`;
        }
    },
    Feminism: {
        color: '#ff66cc',
        description: 'Examines how gender hierarchies shape global power dynamics and whose voices are excluded.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this situation';
            const players = event['Key Player/Organization'] || 'the decision-makers';
            const impact = event['Expected Impact/Value'] || '';

            return `A feminist analysis of "${entity}" asks: where are the women, and whose security is being prioritized? The key players — ${players} — overwhelmingly represent patriarchal power structures. ${impact ? `When we consider the impact ("${impact.substring(0, 100)}"), we must ask how women, LGBTQ+ communities, and marginalized groups are disproportionately harmed — yet excluded from the decision-making table.` : ''} Security must be redefined beyond military terms to include human security: food, health, freedom from violence.`;
        }
    },
    Postcolonialism: {
        color: '#ff9933',
        description: 'Critically analyzes colonial legacies and how Western-centric power dynamics persist today.',
        getInterpretation: (event) => {
            const entity = event['Entity/Subject'] || 'this event';
            const players = event['Key Player/Organization'] || 'the actors';
            const impact = event['Expected Impact/Value'] || '';

            return `A postcolonial reading of "${entity}" reveals the enduring legacy of imperialism. The framing of this issue — who counts as a 'key player' (${players}), whose perspective is centered — reflects deep Eurocentric biases. ${impact ? `The projected outcome ("${impact.substring(0, 100)}") ignores local agency and indigenous knowledge systems, imposing Western frameworks on communities that have their own solutions.` : ''} We must decenter the Western gaze and amplify voices from the Global South.`;
        }
    }
};

export const getTheoryInterpretation = (theoryName, event) => {
    const theory = theories[theoryName];
    if (!theory) return "Select a theory to view perspective.";
    return theory.getInterpretation(event);
};

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
            if (category.includes('Environment') || category.includes('Energy')) {
                return `A realist views "${entity}" through the lens of resource competition. ${players} are driven by energy security and strategic access to resources, not altruism. Environmental agreements are only adhered to when they serve the national interest. Expect states to defect when compliance threatens their relative power.`;
            }
            if (category.includes('Health') || category.includes('Society')) {
                return `Realists would argue that "${entity}" is secondary to the 'high politics' of security and power. ${players} engage in health diplomacy only when it serves strategic interests — vaccine diplomacy, for instance, is a tool of soft power competition. Humanitarian concerns are instrumentalized, not genuinely pursued.`;
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
            const category = event.Broad_Category || '';

            if (category.includes('Conflict') || category.includes('Geopolitics')) {
                return `A liberal analysis sees "${entity}" as a failure of institutional mechanisms. ${players} should be channeling this dispute through multilateral frameworks — the UN Security Council, regional organizations, or international courts. ${impact ? `The expected impact (${impact.substring(0, 120)}) could be mitigated through collective security, arms control treaties, and diplomatic engagement.` : ''} Democratic peace theory suggests that promoting democratic governance reduces the likelihood of such conflicts.`;
            }
            if (category.includes('Economy') || category.includes('Trade')) {
                return `Liberals view "${entity}" through the lens of complex interdependence. ${players} are embedded in a web of economic relationships where cooperation produces mutual gains. ${impact ? `The projected impact (${impact.substring(0, 100)}) should be managed through international institutions like the WTO, IMF, and bilateral trade agreements.` : ''} Free trade and open markets, governed by transparent rules, benefit all parties.`;
            }
            if (category.includes('Technology')) {
                return `A liberal perspective on "${entity}" emphasizes the need for international norms and governance frameworks. ${players} should collaborate on standard-setting, data protection, and ethical guidelines. Technology governance requires multilateral cooperation — no single state can regulate global digital flows alone. Transparency and accountability are essential.`;
            }
            if (category.includes('Environment') || category.includes('Energy')) {
                return `Liberals see "${entity}" as a classic collective action problem requiring institutional solutions. ${players} must work through frameworks like the Paris Agreement, UNFCCC, and green finance mechanisms. ${impact ? `The projected impact (${impact.substring(0, 100)}) demonstrates why multilateral environmental governance is essential` : 'Environmental protection'} — no state can solve climate change alone. International cooperation is not optional; it is existential.`;
            }
            if (category.includes('Health') || category.includes('Society')) {
                return `A liberal analysis of "${entity}" highlights the role of international institutions (WHO, UNICEF, MSF) and human rights norms. ${players} should be strengthening global health governance and ensuring equitable access. ${impact ? `The expected impact (${impact.substring(0, 100)}) underscores why health is a global public good requiring collective action.` : ''} Democratic accountability and press freedom are crucial for effective public health responses.`;
            }
            if (category.includes('Culture')) {
                return `Liberals celebrate "${entity}" as evidence of cultural exchange and soft power in action. ${players} demonstrate how globalization creates shared understanding across borders. Cultural diplomacy, people-to-people ties, and free information flows strengthen the foundations of international cooperation.`;
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
            const category = event.Broad_Category || '';

            if (category.includes('Economy') || category.includes('Trade') || impact.includes('$')) {
                return `"${entity}" exposes the contradictions of global capitalism. The involvement of ${players} serves the interests of capital accumulation, not ordinary workers. ${impact ? `When we read "${impact.substring(0, 120)}," we must ask: who profits, and whose labor is being exploited?` : ''} The Global South bears the heaviest burden while transnational elites capture the gains.`;
            }
            if (category.includes('Conflict') || category.includes('Geopolitics')) {
                return `A Marxist analysis of "${entity}" reveals that ${players} are driven not by ideology or security, but by underlying material and economic interests. Wars and conflicts serve the military-industrial complex and distract the working class from domestic exploitation. Follow the money — who benefits from escalation?`;
            }
            if (category.includes('Technology')) {
                return `"${entity}" must be analyzed in terms of who owns and controls the means of technological production. ${players} are accumulating technological capital that deepens class divisions — automating labor, concentrating wealth, and extending surveillance over workers. ${impact ? `The impact (${impact.substring(0, 100)}) will disproportionately benefit the owning class.` : ''}`;
            }
            if (category.includes('Health') || category.includes('Society')) {
                return `"${entity}" reveals how health outcomes are determined by class position. ${players} operate within a system where healthcare is commodified — the rich access cutting-edge treatment while the poor are denied basic care. ${impact ? `The projected impact (${impact.substring(0, 100)}) cannot be understood without examining the class dynamics at play.` : ''}`;
            }
            if (category.includes('Environment') || category.includes('Energy')) {
                return `A Marxist reading of "${entity}" shows that environmental destruction is inherent to capitalism's logic of endless accumulation. ${players} treat nature as a free resource to exploit. Climate change is not a market failure — it is the market working exactly as designed, externalizing costs onto the poorest and future generations.`;
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
            const category = event.Broad_Category || '';

            if (category.includes('Economy') || category.includes('Trade')) {
                return `"${entity}" must be analyzed through the Core-Periphery model. ${players} operate within a global economic hierarchy where Core states (USA, EU, Japan) control capital, technology, and terms of trade, while Periphery states export raw materials and cheap labor. ${impact ? `The expected outcome — ${impact.substring(0, 120)} — will likely deepen structural dependency rather than promote genuine development.` : ''} Unequal exchange is built into the system.`;
            }
            if (category.includes('Conflict') || category.includes('Geopolitics')) {
                return `A structuralist reading of "${entity}" reveals how Core states use military power and alliances to maintain the global hierarchy. ${players} are positioned within a system where peripheral states have little autonomy — their foreign policies are constrained by dependency on Core military protection and economic aid. Conflict in the periphery often serves Core interests.`;
            }
            if (category.includes('Technology')) {
                return `"${entity}" illustrates the technological dependency trap. ${players} from Core states control patents, R&D, and digital infrastructure, while Periphery states are forced to import technology on unfavorable terms. ${impact ? `The impact (${impact.substring(0, 100)}) will widen the technological gap between North and South.` : ''} Without technology transfer, the structural hierarchy deepens.`;
            }
            if (category.includes('Environment') || category.includes('Energy')) {
                return `A structuralist analysis of "${entity}" shows that environmental degradation flows from Core exploitation of Periphery resources. ${players} perpetuate a system where the Global South bears the ecological costs of Northern consumption — extractive industries, monoculture agriculture, and toxic waste dumping follow the Core-Periphery divide.`;
            }
            if (category.includes('Health') || category.includes('Society')) {
                return `"${entity}" reflects the health inequalities embedded in the Core-Periphery structure. ${players} operate in a system where Core states monopolize pharmaceutical patents and medical expertise, while Periphery states face brain drain, underfunded health systems, and dependency on external aid. ${impact ? `The projected impact (${impact.substring(0, 100)}) will disproportionately affect the Global South.` : ''}`;
            }
            return `"${entity}" must be understood within the global Core-Periphery structure. ${players} operate within a hierarchy where 'Core' states set the rules, and 'Periphery' states are structurally dependent on them. True change requires restructuring the entire system, not just adjusting policies within it.`;
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

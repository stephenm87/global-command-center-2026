// Specific sovereign states, UN observers, territories, case-study locations, and sub-regions.
// Matched by earliest appearance in title (longest match breaks ties at the same start index), then snippet, then continents.
// Never include "un" (a UN-published story is not located in New York), bare "us" (pronoun), or bare "america".
const SPECIFIC_PLACE_COORDS = Object.freeze({
    // Africa (54 UN member states + territories & case-study locations)
    'democratic republic of the congo': [-4.0, 21.8],
    'central african republic': [6.6, 20.9],
    'são tomé and príncipe': [0.2, 6.6],
    'sao tome and principe': [0.2, 6.6],
    'republic of the congo': [-0.2, 15.8],
    'equatorial guinea': [1.65, 10.27],
    'congo-brazzaville': [-0.2, 15.8],
    'guinea-bissau': [11.8, -15.2],
    'horn of africa': [8.0, 45.0],
    'côte d\'ivoire': [7.5, -5.5],
    'cote d\'ivoire': [7.5, -5.5],
    'sierra leone': [8.5, -11.8],
    'burkina faso': [12.2, -1.6],
    'south africa': [-30.6, 22.9],
    'south sudan': [6.9, 31.3],
    'ivory coast': [7.5, -5.5],
    'addis ababa': [9.0, 38.7],
    'ouagadougou': [12.4, -1.5],
    'laascaanood': [8.5, 47.4],
    'port sudan': [19.6, 37.2],
    'cabo verde': [16.5, -23.0],
    'cape verde': [16.5, -23.0],
    'somaliland': [9.6, 44.1],
    'madagascar': [-18.8, 46.9],
    'mauritania': [21.0, -10.9],
    'mozambique': [-18.7, 35.5],
    'seychelles': [-4.7, 55.5],
    'cape town': [-33.9, 18.4],
    'adré, chad': [13.5, 22.2],
    'mogadishu': [2.0, 45.3],
    'swaziland': [-26.5, 31.5],
    'mauritius': [-20.3, 57.6],
    'the gambia': [13.4, -15.3],
    'el fasher': [13.6, 25.3],
    'cameroon': [7.4, 12.4],
    'djibouti': [11.8, 42.6],
    'eswatini': [-26.5, 31.5],
    'ethiopia': [9.1, 40.5],
    'botswana': [-22.3, 24.7],
    'tanzania': [-6.4, 34.9],
    'zimbabwe': [-19.0, 29.2],
    'dr congo': [-4.0, 21.8],
    'hargeisa': [9.6, 44.1],
    'khartoum': [15.5, 32.6],
    'kinshasa': [-4.3, 15.3],
    'las anod': [8.5, 47.4],
    'berbera': [10.4, 45.0],
    'comoros': [-11.7, 43.3],
    'eritrea': [15.2, 39.8],
    'liberia': [6.4, -9.4],
    'namibia': [-22.6, 17.1],
    'nigeria': [9.1, 8.7],
    'senegal': [14.5, -14.5],
    'somalia': [5.2, 46.2],
    'burundi': [-3.4, 29.9],
    'lesotho': [-29.6, 28.2],
    'angola': [-11.2, 17.9],
    'darfur': [13.6, 25.3],
    'gambia': [13.4, -15.3],
    'guinea': [9.95, -9.7],
    'malawi': [-13.3, 34.3],
    'rwanda': [-1.9, 29.9],
    'uganda': [1.4, 32.3],
    'zambia': [-13.1, 27.8],
    'bamako': [12.6, -8.0],
    'niamey': [13.5, 2.1],
    'bukavu': [-2.5, 28.9],
    'kigali': [-1.95, 30.06],
    'kariba': [-16.5, 28.8],
    'lusaka': [-15.4, 28.3],
    'harare': [-17.8, 31.0],
    'zambezi': [-15.5, 25.0],
    'benin': [9.3, 2.3],
    'congo': [-4.0, 21.8],
    'gabon': [-0.8, 11.6],
    'ghana': [7.9, -1.0],
    'kenya': [-0.02, 37.9],
    'niger': [17.6, 8.1],
    'sahel': [14.5, 2.0],
    'sudan': [12.9, 30.2],
    'abuja': [9.1, 7.5],
    'kitwe': [-12.8, 28.2],
    'chad': [15.5, 18.7],
    'mali': [17.6, -4.0],
    'togo': [8.6, 0.8],
    'goma': [-1.7, 29.2],
    'drc': [-4.0, 21.8],

    // Middle East & North Africa
    'united arab emirates': [24.5, 54.4],
    'state of palestine': [31.9, 35.2],
    'western sahara': [24.2, -12.9],
    'bab el-mandeb': [12.6, 43.3],
    'saudi arabia': [23.9, 45.1],
    'persian gulf': [26.8, 51.5],
    'ras al-ain': [36.8, 40.1],
    'tell abyad': [36.7, 38.9],
    'west bank': [31.9, 35.3],
    'el aaiún': [27.1, -13.2],
    'el aaiun': [27.1, -13.2],
    'benghazi': [32.1, 20.1],
    'damascus': [33.5, 36.3],
    'hodeidah': [14.8, 42.9],
    'hudaydah': [14.8, 42.9],
    'laayoune': [27.1, -13.2],
    palestine: [31.9, 35.2],
    'red sea': [20.0, 38.5],
    'tindouf': [27.7, -8.1],
    'tripoli': [32.9, 13.2],
    algeria: [28.0, 1.7],
    morocco: [31.8, -7.1],
    tunisia: [33.9, 9.5],
    lebanon: [33.9, 35.9],
    bahrain: [26.0, 50.6],
    algiers: [36.8, 3.1],
    "sana'a": [15.4, 44.2],
    israel: [31.0, 34.9],
    jordan: [30.6, 36.2],
    kuwait: [29.3, 47.5],
    hormuz: [26.6, 56.3],
    aleppo: [36.2, 37.2],
    rabat: [34.0, -6.8],
    sabha: [27.0, 14.4],
    sanaa: [15.4, 44.2],
    sirte: [31.2, 16.6],
    syria: [34.8, 38.9],
    yemen: [15.6, 48.5],
    libya: [26.3, 17.2],
    egypt: [26.8, 30.8],
    qatar: [25.4, 51.2],
    aden: [12.8, 45.0],
    gaza: [31.5, 34.5],
    iran: [32.4, 53.7],
    iraq: [33.2, 43.7],
    oman: [21.5, 55.9],
    uae: [24.5, 54.4],

    // Asia-Pacific & Central Asia
    'second thomas shoal': [9.7, 115.9],
    'brunei darussalam': [4.5, 114.7],
    'scarborough shoal': [15.1, 117.8],
    'south china sea': [14.0, 114.0],
    'mischief reef': [9.9, 115.5],
    'taiping island': [10.4, 114.4],
    'central asia': [42.0, 68.0],
    'timor-leste': [-8.9, 125.7],
    'north korea': [40.3, 127.5],
    'south korea': [36.5, 127.9],
    'east timor': [-8.9, 125.7],
    'ulaanbaatar': [47.9, 106.9],
    afghanistan: [33.9, 67.7],
    'oyu tolgoi': [43.0, 106.8],
    'hong kong': [22.3, 114.2],
    macau: [22.2, 113.5],
    macao: [22.2, 113.5],
    'islamabad': [33.7, 73.1],
    'new delhi': [28.6, 77.2],
    'raja ampat': [-0.5, 130.5],
    'sri lanka': [7.9, 80.8],
    'zamyn-uud': [43.7, 111.9],
    turkmenistan: [39.0, 59.6],
    philippines: [12.9, 121.8],
    bangladesh: [23.7, 90.4],
    kazakhstan: [48.0, 66.9],
    kyrgyzstan: [41.2, 74.8],
    tajikistan: [38.9, 71.3],
    uzbekistan: [41.4, 64.6],
    chattogram: [22.3, 91.8],
    chittagong: [22.3, 91.8],
    'vientiane': [18.0, 102.6],
    'tonle sap': [12.9, 104.1],
    indonesia: [-0.8, 113.9],
    singapore: [1.35, 103.8],
    'naypyidaw': [19.7, 96.1],
    'sainshand': [44.9, 110.1],
    'srinagar': [34.1, 74.8],
    'dushanbe': [38.6, 68.8],
    'ferghana': [40.4, 71.8],
    'morowali': [-2.6, 121.9],
    'weda bay': [0.5, 128.0],
    'xayaburi': [19.2, 101.8],
    'viet nam': [14.1, 108.3],
    cambodia: [12.6, 105.0],
    malaysia: [4.2, 101.9],
    maldives: [3.2, 73.2],
    mongolia: [46.9, 103.8],
    pakistan: [30.4, 69.3],
    thailand: [15.9, 101.0],
    'lao pdr': [19.9, 102.5],
    'can tho': [10.0, 105.8],
    'itu aba': [10.4, 114.4],
    'bishkek': [42.9, 74.6],
    'khujand': [40.3, 69.6],
    'pakokku': [21.3, 95.1],
    'tarbela': [34.1, 72.7],
    'kashmir': [34.1, 74.8],
    'jakarta': [-6.2, 106.8],
    myanmar: [19.2, 96.7],
    vietnam: [14.1, 108.3],
    bhutan: [27.5, 90.4],
    brunei: [4.5, 114.7],
    manila: [14.6, 121.0],
    mekong: [15.0, 105.5],
    taiwan: [23.7, 120.9],
    batken: [40.1, 70.8],
    yangon: [16.8, 96.2],
    burma: [19.2, 96.7],
    china: [35.9, 104.2],
    india: [20.6, 79.0],
    japan: [36.2, 138.3],
    korea: [36.5, 127.9],
    nepal: [28.4, 84.1],
    indus: [30.0, 71.0],
    dhaka: [23.8, 90.4],
    dprk: [40.3, 127.5],
    laos: [19.9, 102.5],

    // Europe & Eurasia (43 UN member states + Holy See + territories/case-study locations)
    'bosnia and herzegovina': [43.9, 17.7],
    'russian federation': [61.5, 105.3],
    'north macedonia': [41.6, 21.7],
    'the netherlands': [52.1, 5.3],
    'czech republic': [49.8, 15.5],
    'european union': [50.8, 4.3],
    'united kingdom': [55.4, -3.4],
    'liechtenstein': [47.2, 9.5],
    transnistria: [46.8, 29.6],
    'vatican city': [41.9, 12.5],
    switzerland: [46.8, 8.2],
    netherlands: [52.1, 5.3],
    azerbaijan: [40.1, 47.6],
    copenhagen: [55.7, 12.6],
    luxembourg: [49.8, 6.1],
    montenegro: [42.7, 19.4],
    'san marino': [43.9, 12.5],
    'the hague': [52.1, 4.3],
    'vulcănești': [45.7, 28.4],
    vulcanesti: [45.7, 28.4],
    greenland: [64.2, -51.7],
    lithuania: [55.2, 23.9],
    'holy see': [41.9, 12.5],
    bulgaria: [42.7, 25.5],
    portugal: [39.4, -8.2],
    slovakia: [48.7, 19.7],
    slovenia: [46.2, 15.0],
    chișinău: [47.0, 28.9],
    chisinau: [47.0, 28.9],
    tiraspol: [46.8, 29.6],
    albania: [41.2, 20.2],
    andorra: [42.5, 1.6],
    armenia: [40.1, 45.0],
    austria: [47.5, 14.6],
    balkans: [43.0, 20.0],
    belarus: [53.7, 27.9],
    belgium: [50.5, 4.5],
    britain: [55.4, -3.4],
    brussels: [50.8, 4.3],
    croatia: [45.1, 15.2],
    czechia: [49.8, 15.5],
    denmark: [56.3, 9.5],
    estonia: [58.6, 25.0],
    finland: [61.9, 25.7],
    georgia: [42.3, 43.4],
    germany: [51.2, 10.5],
    holland: [52.1, 5.3],
    hungary: [47.2, 19.5],
    iceland: [64.9, -19.0],
    ireland: [53.1, -7.7],
    moldova: [47.4, 28.4],
    romania: [45.9, 25.0],
    türkiye: [38.9, 35.2],
    turkiye: [38.9, 35.2],
    ukraine: [49.0, 31.2],
    vatican: [41.9, 12.5],
    arctic: [75.0, -40.0],
    bosnia: [43.9, 17.7],
    cyprus: [35.1, 33.4],
    france: [46.2, 2.2],
    geneva: [46.2, 6.1],
    greece: [39.1, 21.8],
    kosovo: [42.6, 20.9],
    latvia: [56.9, 24.6],
    monaco: [43.7, 7.4],
    norway: [60.5, 8.5],
    poland: [51.9, 19.1],
    russia: [61.5, 105.3],
    serbia: [44.0, 21.0],
    sweden: [60.1, 18.6],
    turkey: [38.9, 35.2],
    italy: [41.9, 12.6],
    malta: [35.9, 14.4],
    spain: [40.5, -3.7],
    nato: [50.8, 4.3],
    nuuk: [64.2, -51.7],
    'u.k.': [55.4, -3.4],
    uk: [55.4, -3.4],

    // Americas & Caribbean (35 UN member states + case-study locations)
    'saint vincent and the grenadines': [13.0, -61.2],
    'st. vincent and the grenadines': [13.0, -61.2],
    'st vincent and the grenadines': [13.0, -61.2],
    'saint kitts and nevis': [17.4, -62.8],
    'st. kitts and nevis': [17.4, -62.8],
    'st kitts and nevis': [17.4, -62.8],
    'antigua and barbuda': [17.1, -61.8],
    'trinidad and tobago': [10.7, -61.2],
    'dominican republic': [18.7, -70.2],
    'amazon rainforest': [-3.1, -60.0],
    'central america': [13.8, -86.2],
    'washington, d.c.': [38.9, -77.0],
    'port-au-prince': [18.5, -72.3],
    'washington, dc': [38.9, -77.0],
    'santo domingo': [18.5, -69.9],
    'united states': [37.1, -95.6],
    'amazon basin': [-3.1, -60.0],
    'ciudad juárez': [31.7, -106.5],
    'ciudad juarez': [31.7, -106.5],
    'cap-haïtien': [19.8, -72.2],
    'cap-haitien': [19.8, -72.2],
    'el salvador': [13.8, -88.9],
    'mexico city': [19.4, -99.1],
    'saint lucia': [13.9, -61.0],
    'the bahamas': [25.0, -77.4],
    'artibonite': [19.4, -72.7],
    'costa rica': [9.7, -83.8],
    'rio grande': [29.5, -104.2],
    'rio bravo': [29.5, -104.2],
    'st. lucia': [13.9, -61.0],
    'st lucia': [13.9, -61.0],
    argentina: [-38.4, -63.6],
    essequibo: [6.5, -59.5],
    guatemala: [15.8, -90.2],
    matamoros: [25.9, -97.5],
    nicaragua: [12.9, -85.2],
    venezuela: [6.4, -66.6],
    barbados: [13.2, -59.5],
    colombia: [4.6, -74.1],
    dominica: [15.4, -61.4],
    gonaïves: [19.4, -72.7],
    gonaives: [19.4, -72.7],
    honduras: [15.2, -86.2],
    paraguay: [-23.4, -58.4],
    suriname: [3.9, -56.0],
    trinidad: [10.7, -61.2],
    bahamas: [25.0, -77.4],
    bolivia: [-16.3, -63.6],
    caracas: [10.5, -66.9],
    ecuador: [-1.8, -78.2],
    'el paso': [31.8, -106.5],
    grenada: [12.1, -61.7],
    iquitos: [-3.7, -73.3],
    jamaica: [18.1, -77.3],
    leticia: [-4.2, -69.9],
    uruguay: [-32.5, -55.8],
    belize: [17.2, -88.5],
    bogotá: [4.7, -74.1],
    bogota: [4.7, -74.1],
    brazil: [-14.2, -51.9],
    canada: [56.1, -106.3],
    guyana: [4.9, -58.9],
    manaus: [-3.1, -60.0],
    mexico: [23.6, -102.5],
    ottawa: [45.4, -75.7],
    panama: [8.5, -80.8],
    chile: [-35.7, -71.5],
    haiti: [18.9, -72.3],
    cuba: [21.5, -77.8],
    peru: [-9.2, -75.0],
    puyo: [-1.5, -78.0],
    'u.s.a.': [37.1, -95.6],
    'u.s.': [37.1, -95.6],
    usa: [37.1, -95.6],

    // Pacific Islands & Oceania (14 UN member states + territories/case-study locations)
    'federated states of micronesia': [7.4, 150.6],
    'clarion–clipperton zone': [14.0, -130.0],
    'clarion-clipperton zone': [14.0, -130.0],
    'papua new guinea': [-6.3, 143.9],
    'french polynesia': [-17.6, -149.4],
    'marshall islands': [7.1, 171.2],
    'solomon islands': [-9.6, 160.2],
    'american samoa': [-14.3, -170.7],
    'new caledonia': [-20.9, 165.6],
    'weather coast': [-9.7, 160.1],
    'new zealand': [-40.9, 174.9],
    'cook islands': [-21.2, -159.8],
    'new ireland': [-3.0, 151.6],
    'port moresby': [-9.4, 147.2],
    'bougainville': [-6.2, 155.4],
    "nuku'alofa": [-21.1, -175.2],
    'port vila': [-17.7, 168.3],
    'micronesia': [7.4, 150.6],
    australia: [-25.3, 133.8],
    canberra: [-35.3, 149.1],
    funafuti: [-8.5, 179.2],
    kiribati: [1.9, -157.4],
    vanuatu: [-15.4, 166.9],
    honiara: [-9.4, 159.95],
    palikir: [6.9, 158.2],
    tuvalu: [-7.1, 177.6],
    majuro: [7.1, 171.4],
    tarawa: [1.3, 173.0],
    nauru: [-0.5, 166.9],
    palau: [7.5, 134.6],
    samoa: [-13.8, -172.1],
    tonga: [-21.2, -175.2],
    yaren: [-0.5, 166.9],
    koror: [7.3, 134.5],
    apia: [-13.8, -171.8],
    fiji: [-17.7, 178.1],
    guam: [13.4, 144.8],
    suva: [-18.1, 178.4],
});

const CONTINENT_COORDS = Object.freeze({
    'latin america': [-8.0, -63.0],
    'south america': [-14.0, -60.0],
    'pacific islands': [-13.5, 172.0],
    'middle east': [27.5, 42.0],
    caribbean: [18.2, -72.5],
    oceania: [-18.0, 165.0],
    europe: [50.8, 15.3],
    africa: [6.5, 21.8],
    asia: [28.0, 100.0],
});

const REGION_COORDS = Object.freeze({
    ...SPECIFIC_PLACE_COORDS,
    ...CONTINENT_COORDS,
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileMatchers(table) {
    return Object.entries(table)
        .sort((a, b) => b[0].length - a[0].length)
        .map(([key, coords]) => {
            const extraLookahead = key === 'guinea'
                ? '(?!\\s+pigs?(?![\\p{L}\\p{N}])|-bissauan?s?(?![\\p{L}\\p{N}]))'
                : '';
            return {
                key,
                coords,
                pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(key)}${extraLookahead}(?![\\p{L}\\p{N}])`, 'iu'),
            };
        });
}

const UN_MEMBER_STATE_DEMONYMS = Object.freeze({
    // Africa (54 UN member states)
    algeria: ['algerian', 'algerians'],
    angola: ['angolan', 'angolans'],
    benin: ['beninese', 'beninois'],
    botswana: ['botswanan', 'botswanans', 'motswana', 'batswana'],
    'burkina faso': ['burkinabe', 'burkinabé', 'burkinabes', 'burkinabés'],
    burundi: ['burundian', 'burundians'],
    'cabo verde': ['cabo verdean', 'cabo verdeans', 'cape verdean', 'cape verdeans'],
    cameroon: ['cameroonian', 'cameroonians'],
    'central african republic': ['central african', 'central africans'],
    chad: ['chadian', 'chadians'],
    comoros: ['comoran', 'comorans', 'comorian', 'comorians'],
    'democratic republic of the congo': ['congolese'],
    'republic of the congo': ['congolese'],
    "côte d'ivoire": ['ivorian', 'ivorians', 'ivoirian', 'ivoirians'],
    djibouti: ['djiboutian', 'djiboutians'],
    egypt: ['egyptian', 'egyptians'],
    'equatorial guinea': ['equatoguinean', 'equatoguineans', 'equatorial guinean', 'equatorial guineans'],
    eritrea: ['eritrean', 'eritreans'],
    eswatini: ['swazi', 'swazis', 'emaswati'],
    ethiopia: ['ethiopian', 'ethiopians'],
    gabon: ['gabonese'],
    gambia: ['gambian', 'gambians'],
    ghana: ['ghanaian', 'ghanaians'],
    guinea: ['guinean', 'guineans'],
    'guinea-bissau': ['bissau-guinean', 'bissau-guineans', 'guinea-bissauan', 'guinea-bissauans'],
    kenya: ['kenyan', 'kenyans'],
    lesotho: ['mosotho', 'basotho', 'lesothan', 'lesothans'],
    liberia: ['liberian', 'liberians'],
    libya: ['libyan', 'libyans'],
    madagascar: ['malagasy', 'madagascan', 'madagascans'],
    malawi: ['malawian', 'malawians'],
    mali: ['malian', 'malians'],
    mauritania: ['mauritanian', 'mauritanians'],
    mauritius: ['mauritian', 'mauritians'],
    morocco: ['moroccan', 'moroccans'],
    mozambique: ['mozambican', 'mozambicans'],
    namibia: ['namibian', 'namibians'],
    niger: ['nigerien', 'nigeriens', 'nigérien', 'nigériens'],
    nigeria: ['nigerian', 'nigerians'],
    rwanda: ['rwandan', 'rwandans', 'rwandese'],
    'são tomé and príncipe': ['são toméan', 'são toméans', 'sao tomean', 'sao tomeans', 'santomean', 'santomeans'],
    senegal: ['senegalese'],
    seychelles: ['seychellois', 'seychelloise', 'seychelloises'],
    'sierra leone': ['sierra leonean', 'sierra leoneans'],
    somalia: ['somali', 'somalis', 'somalian', 'somalians'],
    'south africa': ['south african', 'south africans'],
    'south sudan': ['south sudanese'],
    sudan: ['sudanese'],
    tanzania: ['tanzanian', 'tanzanians'],
    togo: ['togolese'],
    tunisia: ['tunisian', 'tunisians'],
    uganda: ['ugandan', 'ugandans'],
    zambia: ['zambian', 'zambians'],
    zimbabwe: ['zimbabwean', 'zimbabweans'],

    // Asia-Pacific & Middle East (46 UN member states)
    afghanistan: ['afghan', 'afghans'],
    armenia: ['armenian', 'armenians'],
    azerbaijan: ['azerbaijani', 'azerbaijanis', 'azeri', 'azeris'],
    bahrain: ['bahraini', 'bahrainis'],
    bangladesh: ['bangladeshi', 'bangladeshis'],
    bhutan: ['bhutanese'],
    brunei: ['bruneian', 'bruneians'],
    cambodia: ['cambodian', 'cambodians'],
    china: ['chinese'],
    cyprus: ['cypriot', 'cypriots'],
    'north korea': ['north korean', 'north koreans'],
    india: ['indian', 'indians'],
    indonesia: ['indonesian', 'indonesians'],
    iran: ['iranian', 'iranians'],
    iraq: ['iraqi', 'iraqis'],
    israel: ['israeli', 'israelis'],
    japan: ['japanese'],
    jordan: ['jordanian', 'jordanians'],
    kazakhstan: ['kazakh', 'kazakhs', 'kazakhstani', 'kazakhstanis'],
    kuwait: ['kuwaiti', 'kuwaitis'],
    kyrgyzstan: ['kyrgyz', 'kyrgyzstani', 'kyrgyzstanis'],
    laos: ['laotian', 'laotians', 'Lao'],
    lebanon: ['lebanese'],
    malaysia: ['malaysian', 'malaysians'],
    maldives: ['maldivian', 'maldivians'],
    mongolia: ['mongolian', 'mongolians'],
    myanmar: ['myanmarese', 'burmese'],
    nepal: ['nepali', 'nepalis', 'nepalese'],
    oman: ['omani', 'omanis'],
    pakistan: ['pakistani', 'pakistanis'],
    philippines: ['philippine', 'filipino', 'filipinos', 'filipina', 'filipinas'],
    qatar: ['qatari', 'qataris'],
    'south korea': ['south korean', 'south koreans', 'korean', 'koreans'],
    'saudi arabia': ['saudi', 'saudis', 'saudi arabian', 'saudi arabians'],
    singapore: ['singaporean', 'singaporeans'],
    'sri lanka': ['sri lankan', 'sri lankans'],
    syria: ['syrian', 'syrians'],
    tajikistan: ['tajik', 'tajiks', 'tajikistani', 'tajikistanis'],
    thailand: ['thai'],
    'timor-leste': ['timorese', 'east timorese'],
    'türkiye': ['turkish'],
    turkmenistan: ['turkmen', 'turkmens', 'turkmenistani'],
    'united arab emirates': ['emirati', 'emiratis'],
    uzbekistan: ['uzbek', 'uzbeks', 'uzbekistani', 'uzbekistanis'],
    vietnam: ['vietnamese'],
    yemen: ['yemeni', 'yemenis', 'yemenite', 'yemenites'],

    // Europe & Eurasia (44 UN member states)
    albania: ['albanian', 'albanians'],
    andorra: ['andorran', 'andorrans'],
    austria: ['austrian', 'austrians'],
    belarus: ['belarusian', 'belarusians'],
    belgium: ['belgian', 'belgians'],
    'bosnia and herzegovina': ['bosnian', 'bosnians', 'herzegovinian', 'herzegovinians'],
    bulgaria: ['bulgarian', 'bulgarians'],
    croatia: ['croatian', 'croatians', 'croat', 'croats'],
    czechia: ['czech', 'czechs'],
    denmark: ['danish', 'Dane', 'Danes'],
    estonia: ['estonian', 'estonians'],
    finland: ['finnish', 'Finn', 'Finns'],
    france: ['french'],
    georgia: ['georgian', 'georgians'],
    germany: ['german', 'germans'],
    greece: ['greek', 'greeks'],
    hungary: ['hungarian', 'hungarians'],
    iceland: ['icelandic', 'icelander', 'icelanders'],
    ireland: ['irish'],
    italy: ['italian', 'italians'],
    latvia: ['latvian', 'latvians'],
    liechtenstein: ['liechtensteiner', 'liechtensteiners'],
    lithuania: ['lithuanian', 'lithuanians'],
    luxembourg: ['luxembourgish', 'luxembourger', 'luxembourgers'],
    malta: ['maltese'],
    moldova: ['moldovan', 'moldovans'],
    monaco: ['monegasque', 'monégasque', 'monegasques', 'monacan', 'monacans'],
    montenegro: ['montenegrin', 'montenegrins'],
    netherlands: ['Dutch', 'netherlandic'],
    'north macedonia': ['north macedonian', 'north macedonians', 'macedonian', 'macedonians'],
    norway: ['norwegian', 'norwegians'],
    poland: ['Polish'],
    portugal: ['portuguese'],
    romania: ['romanian', 'romanians'],
    russia: ['russian', 'russians'],
    'san marino': ['sammarinese'],
    serbia: ['serbian', 'serbians', 'serb', 'serbs'],
    slovakia: ['slovak', 'slovaks', 'slovakian', 'slovakians'],
    slovenia: ['slovenian', 'slovenians', 'slovene', 'slovenes'],
    spain: ['spanish', 'spaniard', 'spaniards'],
    sweden: ['swedish', 'swede', 'swedes'],
    switzerland: ['swiss'],
    ukraine: ['ukrainian', 'ukrainians'],
    'united kingdom': ['british'],

    // Americas & Caribbean (35 UN member states)
    'antigua and barbuda': ['antiguan', 'antiguans', 'barbudan', 'barbudans'],
    argentina: ['argentine', 'argentines', 'argentinian', 'argentinians'],
    bahamas: ['bahamian', 'bahamians'],
    barbados: ['barbadian', 'barbadians', 'bajan', 'bajans'],
    belize: ['belizean', 'belizeans'],
    bolivia: ['bolivian', 'bolivians'],
    brazil: ['brazilian', 'brazilians'],
    canada: ['canadian', 'canadians'],
    chile: ['chilean', 'chileans'],
    colombia: ['colombian', 'colombians'],
    'costa rica': ['costa rican', 'costa ricans'],
    cuba: ['cuban', 'cubans'],
    dominica: ['dominican commonwealth'],
    'dominican republic': ['dominican', 'dominicans'],
    ecuador: ['ecuadorian', 'ecuadorians', 'ecuadorean'],
    'el salvador': ['salvadoran', 'salvadorans'],
    grenada: ['grenadian', 'grenadians'],
    guatemala: ['guatemalan', 'guatemalans'],
    guyana: ['guyanese'],
    haiti: ['haitian', 'haitians'],
    honduras: ['honduran', 'hondurans'],
    jamaica: ['jamaican', 'jamaicans'],
    mexico: ['mexican', 'mexicans'],
    nicaragua: ['nicaraguan', 'nicaraguans'],
    panama: ['panamanian', 'panamanians'],
    paraguay: ['paraguayan', 'paraguayans'],
    peru: ['peruvian', 'peruvians'],
    'saint kitts and nevis': ['kittitian', 'kittitians', 'nevisian', 'nevisians'],
    'saint lucia': ['saint lucian', 'saint lucians', 'st. lucian', 'st. lucians', 'st lucian'],
    'saint vincent and the grenadines': ['vincentian', 'vincentians'],
    suriname: ['surinamese'],
    'trinidad and tobago': ['trinidadian', 'trinidadians', 'tobagonian', 'tobagonians', 'trinbagonian'],
    'united states': ['american', 'americans'],
    uruguay: ['uruguayan', 'uruguayans'],
    venezuela: ['venezuelan', 'venezuelans'],

    // Oceania (14 UN member states)
    australia: ['australian', 'australians'],
    fiji: ['fijian', 'fijians'],
    kiribati: ['i-kiribati'],
    'marshall islands': ['marshallese'],
    micronesia: ['micronesian', 'micronesians'],
    nauru: ['nauruan', 'nauruans'],
    'new zealand': ['new zealander', 'new zealanders'],
    palau: ['palauan', 'palauans'],
    'papua new guinea': ['papua new guinean', 'papua new guineans'],
    samoa: ['samoan', 'samoans'],
    'solomon islands': ['solomon islander', 'solomon islanders'],
    tonga: ['tongan', 'tongans'],
    tuvalu: ['tuvaluan', 'tuvaluans'],
    vanuatu: ['ni-vanuatu', 'vanuatuan', 'vanuatuans'],
});

const OBSERVER_AND_TERRITORY_DEMONYMS = Object.freeze({
    palestine: ['palestinian', 'palestinians'],
    taiwan: ['taiwanese'],
    'hong kong': ['hong konger', 'hong kongers', 'hongkonger', 'hongkongers'],
    macau: ['macanese'],
    kosovo: ['kosovar', 'kosovars'],
    greenland: ['greenlandic'],
    'western sahara': ['sahrawi', 'sahrawis'],
    somaliland: ['somalilander', 'somalilanders'],
    'american samoa': ['american samoan', 'american samoans'],
});

const UN_MEMBER_DEMONYMS = Object.freeze(
    Object.entries({ ...UN_MEMBER_STATE_DEMONYMS, ...OBSERVER_AND_TERRITORY_DEMONYMS })
        .reduce((map, [countryKey, demonyms]) => {
            for (const demonym of demonyms) {
                const normalizedKey = demonym.toLowerCase();
                if (!map[normalizedKey]) map[normalizedKey] = countryKey;
            }
            return map;
        }, {})
);

const CASE_SENSITIVE_DEMONYMS = new Set(['Polish', 'Dutch', 'Lao', 'Dane', 'Danes', 'Finn', 'Finns']);

const DEMONYM_GUARDS = Object.freeze({
    american: {
        lookbehind: '(?<!(?:latin|south|central|north|pan|inter|meso|anglo|african|native|asian|arab)[\\s-])',
        lookahead: '(?!\\s+(?:samoan?s?|football|idol|eagle|robin|badger)(?![\\p{L}\\p{N}]))',
    },
    americans: {
        lookbehind: '(?<!(?:latin|south|central|north|pan|inter|meso|anglo|african|native|asian|arab)[\\s-])',
    },
    indian: {
        lookahead: '(?!\\s+(?:ocean|summer|corn)(?![\\p{L}\\p{N}]))',
    },
    french: {
        lookahead: '(?!\\s+(?:fries|toast|press|horn|bulldog|braid|doors?|kiss|manicure|polynesia|guiana|southern)(?![\\p{L}\\p{N}]))',
    },
    british: {
        lookahead: '(?!\\s+(?:columbia|virgin\\s+islands|indian\\s+ocean)(?![\\p{L}\\p{N}]))',
    },
    spanish: {
        lookahead: '(?!\\s+(?:fly|flu|moss)(?![\\p{L}\\p{N}]))',
    },
    georgian: {
        lookahead: '(?!\\s+(?:era|architecture|buildings?|townhouse|period)(?![\\p{L}\\p{N}]))',
    },
    guinean: {
        lookbehind: '(?<!(?:papua\\s+new|equatorial|bissau-)[\\s-])',
        lookahead: '(?!\\s+pigs?(?![\\p{L}\\p{N}]))',
    },
    guineans: {
        lookbehind: '(?<!(?:papua\\s+new|equatorial|bissau-)[\\s-])',
    },
    dominican: {
        lookahead: '(?!\\s+(?:order|friars?|monks?|priests?|nuns?|convents?)(?![\\p{L}\\p{N}]))',
    },
    'central african': {
        lookahead: '(?!\\s+(?:countries|nations|states|regions?|summits?|markets?|economies|leaders)(?![\\p{L}\\p{N}]))',
    },
    korean: {
        lookbehind: '(?<!north[\\s-])',
    },
    koreans: {
        lookbehind: '(?<!north[\\s-])',
    },
    sudanese: {
        lookbehind: '(?<!south[\\s-])',
    },
    samoan: {
        lookbehind: '(?<!american[\\s-])',
    },
    samoans: {
        lookbehind: '(?<!american[\\s-])',
    },
    irish: {
        lookbehind: '(?<!northern[\\s-])',
    },
    Dane: {
        lookbehind: '(?<![Gg]reat\\s+)',
        lookahead: '(?!\\s+[Cc]ounty(?![\\p{L}\\p{N}]))',
    },
    Danes: {
        lookbehind: '(?<![Gg]reat\\s+)',
    },
    Dutch: {
        lookahead: '(?!\\s+ovens?(?![\\p{L}\\p{N}]))',
    },
});

const DEMONYM_MATCHERS = Object.entries({ ...UN_MEMBER_STATE_DEMONYMS, ...OBSERVER_AND_TERRITORY_DEMONYMS })
    .flatMap(([countryKey, demonyms]) => demonyms.map(demonym => ({ demonym, countryKey })))
    .filter((entry, idx, arr) => arr.findIndex(x => x.demonym === entry.demonym) === idx)
    .sort((a, b) => b.demonym.length - a.demonym.length)
    .map(({ demonym, countryKey }) => {
        const guard = DEMONYM_GUARDS[demonym] || DEMONYM_GUARDS[demonym.toLowerCase()] || {};
        const flags = CASE_SENSITIVE_DEMONYMS.has(demonym) ? 'u' : 'iu';
        return {
            key: countryKey,
            coords: SPECIFIC_PLACE_COORDS[countryKey],
            pattern: new RegExp(
                `(?<![\\p{L}\\p{N}])${guard.lookbehind || ''}${escapeRegex(demonym)}${guard.lookahead || ''}(?![\\p{L}\\p{N}])`,
                flags
            ),
        };
    });

const PLACE_NAME_MATCHERS = [
    ...compileMatchers(SPECIFIC_PLACE_COORDS),
    // Exact uppercase acronyms avoid matching lowercase "us" or ".png" image extensions
    {
        key: 'united states',
        coords: SPECIFIC_PLACE_COORDS['united states'],
        pattern: /(?<![\p{L}\p{N}])US(?![\p{L}\p{N}])/u,
    },
    {
        key: 'papua new guinea',
        coords: SPECIFIC_PLACE_COORDS['papua new guinea'],
        pattern: /(?<![\p{L}\p{N}.])PNG(?![\p{L}\p{N}.])/u,
    },
];
const CONTINENT_MATCHERS = [
    ...compileMatchers(CONTINENT_COORDS),
    {
        key: 'latin america',
        coords: CONTINENT_COORDS['latin america'],
        pattern: /(?<![\p{L}\p{N}])latin[\s-]+americans?(?![\p{L}\p{N}])/iu,
    },
    {
        key: 'south america',
        coords: CONTINENT_COORDS['south america'],
        pattern: /(?<![\p{L}\p{N}])south[\s-]+americans?(?![\p{L}\p{N}])/iu,
    },
];

const SECTOR_LABELS = {
    'Geopolitics & Conflict': 'Geopolitics / Conflict',
    'Governance & Rights': 'Governance / Human Rights',
    'Economy & Trade': 'Economy / Global',
    'Environment & Energy': 'Environment / Energy',
    'Technology & Science': 'Technology / Security',
    'Health & Society': 'Health / Society',
};

function normalizeTextForMatching(text = '') {
    return String(text || '').normalize('NFC').replace(/[\u2018\u2019]/g, "'");
}

function findFirstMatch(text, matchers) {
    const value = normalizeTextForMatching(text);
    if (!value) return null;
    let bestMatch = null;
    let bestIndex = Number.POSITIVE_INFINITY;
    let bestLength = -1;

    for (const entry of matchers) {
        const matched = entry.pattern.exec(value);
        if (!matched) continue;
        const idx = matched.index;
        const len = matched[0].length;
        if (idx < bestIndex || (idx === bestIndex && len > bestLength)) {
            bestMatch = entry;
            bestIndex = idx;
            bestLength = len;
        }
    }
    return bestMatch;
}

function resolveCoords(title, snippet = '') {
    // Explicit place/country names in the title outrank nationalities/demonyms in the title.
    const titlePlace = findFirstMatch(title, PLACE_NAME_MATCHERS);
    if (titlePlace) {
        return { coords: titlePlace.coords, matchedPlace: titlePlace.key, precision: 'named-place' };
    }
    const titleDemonym = findFirstMatch(title, DEMONYM_MATCHERS);
    if (titleDemonym) {
        return { coords: titleDemonym.coords, matchedPlace: titleDemonym.key, precision: 'named-place' };
    }
    const snippetPlace = findFirstMatch(snippet, PLACE_NAME_MATCHERS);
    if (snippetPlace) {
        return { coords: snippetPlace.coords, matchedPlace: snippetPlace.key, precision: 'named-place' };
    }
    const snippetDemonym = findFirstMatch(snippet, DEMONYM_MATCHERS);
    if (snippetDemonym) {
        return { coords: snippetDemonym.coords, matchedPlace: snippetDemonym.key, precision: 'named-place' };
    }
    const titleContinent = findFirstMatch(title, CONTINENT_MATCHERS);
    if (titleContinent) {
        return { coords: titleContinent.coords, matchedPlace: titleContinent.key, precision: 'regional' };
    }
    const snippetContinent = findFirstMatch(snippet, CONTINENT_MATCHERS);
    if (snippetContinent) {
        return { coords: snippetContinent.coords, matchedPlace: snippetContinent.key, precision: 'regional' };
    }
    return { coords: null, matchedPlace: null, precision: 'fallback' };
}

function getCoords(title, snippet = '') {
    return resolveCoords(title, snippet).coords;
}

function categorizeSector(text) {
    const value = String(text || '').toLowerCase();
    if (/war|conflict|military|attack|missile|sanction|nato|nuclear|troops|coup|siege|weapons|drone/.test(value))
        return 'Geopolitics & Conflict';
    if (/\b(?:elections?|parliaments?|constitutional|judiciar(?:y|ies)|human rights|indigenous|democrac(?:y|ies)|civil liberties|referendums?|self-determination|co-governance)\b/.test(value))
        return 'Governance & Rights';
    if (/economy|economic|trade|gdp|inflation|tariff|market|debt|recession|bank|finance|investment|development|labor|worker|employment|currency|export|import|commodity|supply chain|crypto/.test(value))
        return 'Economy & Trade';
    if (/climate|energy|oil|gas|carbon|emissions|environment|water|ocean|mineral|biodiversity|forest|flooding|drought|cop/.test(value))
        return 'Environment & Energy';
    if (/\bai\b|artificial intelligence|tech|cyber|hack|satellite|space|chip|semiconductor|quantum|digital|information governance|surveillance/.test(value))
        return 'Technology & Science';
    if (/health|pandemic|disease|outbreak|vaccine|hospital|mental|food crisis|famine|refugee|migration|displacement|humanitarian/.test(value))
        return 'Health & Society';
    return 'Geopolitics & Conflict';
}

function normalizeHttpsUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'https:') return '';
        for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_|gclid|fbclid|at_medium|at_campaign)/i.test(key)) url.searchParams.delete(key);
        }
        url.hash = '';
        return url.toString();
    } catch {
        return '';
    }
}

function normalizeProviderArticle(item, scraperSource = 'serper') {
    const url = normalizeHttpsUrl(item?.link || item?.url);
    if (!url || !item?.title) return null;
    const title = String(item.title).trim();
    const snippet = String(item.snippet || item.description || '').trim();
    const combined = `${title} ${snippet}`;
    const category = categorizeSector(combined);
    const resolved = resolveCoords(title, snippet);
    const [lat, lng] = Array.isArray(resolved.coords) ? resolved.coords : [null, null];
    const publishedAt = item.date || item.publishedAt || null;
    const publisherName = item.source?.name || item.source || 'Global News';
    const authorName = typeof item.author === 'string' ? item.author.trim() : '';
    const headlineFallback = scraperSource === 'public-rss' && item.source
        ? `Headline via ${publisherName} — open link to read full report at source.`
        : title;

    return {
        'Topic/Sector': SECTOR_LABELS[category],
        'Entity/Subject': title,
        'Key Player/Organization': publisherName,
        'Timeline': publishedAt ? `CURRENT — ${publishedAt}` : 'CURRENT — date unavailable',
        'Expected Impact/Value': snippet || headlineFallback,
        'Source': publisherName,
        ...(authorName ? { author: authorName } : {}),
        url,
        'Latitude': lat === null ? null : String(lat),
        'Longitude': lng === null ? null : String(lng),
        'Broad_Category': category,
        isScraped: true,
        isLive: true,
        _contentStatus: 'provider-current',
        _scraperSource: scraperSource,
        _coordPrecision: resolved.precision,
        _matchedPlace: resolved.matchedPlace,
        publishedAt,
    };
}

module.exports = {
    CONTINENT_COORDS,
    REGION_COORDS,
    SECTOR_LABELS,
    SPECIFIC_PLACE_COORDS,
    UN_MEMBER_DEMONYMS,
    UN_MEMBER_STATE_DEMONYMS,
    categorizeSector,
    getCoords,
    normalizeHttpsUrl,
    normalizeProviderArticle,
    resolveCoords,
};

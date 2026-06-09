import { CampusLocation } from '../types';

const HIDDEN_BUILDING_IDS = new Set(['lam-woo', 'sc-lw']);

const BUILDINGS: CampusLocation[] = [
    // Ho Sin Hang Campus (HSHC)
    {
        id: 'hshc-ach',
        name: 'ACH',
        category: 'Other',
        coordinates: { latitude: 22.3411647916503, longitude: 114.179545640945 },
        description: 'Academic Community Hall',
        imageUrl: 'https://Example.com/ach.jpg'
    },
    {
        id: 'hshc-lmc',
        name: 'LMC',
        category: 'Study',
        coordinates: { latitude: 22.3410705184075, longitude: 114.179781675339 },
        description: 'Lui Ming Choi Centre',
        imageUrl: 'https://Example.com/lmc.jpg'
    },
    {
        id: 'hshc-oew',
        name: 'OEW',
        category: 'Other',
        coordinates: { latitude: 22.3407529659629, longitude: 114.179459810257 },
        description: 'Oen Hall West Wing',
        imageUrl: 'https://Example.com/oe.jpg'
    },
    {
        id: 'hshc-oee',
        name: 'OEE',
        category: 'Other',
        coordinates: { latitude: 22.3407628894877, longitude: 114.180291295052 },
        description: 'Oen Hall East Wing',
        imageUrl: 'https://Example.com/oe.jpg'
    },
    {
        id: 'hshc-oem',
        name: 'OEM',
        category: 'Other',
        coordinates: { latitude: 22.340842277661, longitude: 114.179905056953 },
        description: 'Oen Hall Main Building',
        imageUrl: 'https://Example.com/oe.jpg'
    },
    {
        id: 'hshc-rrs',
        name: 'RRS',
        category: 'Study',
        coordinates: { latitude: 22.3401774003134, longitude: 114.179647564888 },
        description: 'Sir Run Run Shaw Building',
        imageUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'hshc-ash',
        name: 'ASH',
        category: 'Study',
        coordinates: { latitude: 22.3414327257817, longitude: 114.179953336716 },
        description: 'Au Shue Hung Building',
        imageUrl: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'hshc-stb',
        name: 'STB',
        category: 'Study',
        coordinates: { latitude: 22.3413483762033, longitude: 114.180243015289 },
        description: 'Sing Tao Building',
        imageUrl: 'https://Example.com/stb.jpg'
    },
    {
        id: 'hshc-cec',
        name: 'CEC',
        category: 'Other',
        coordinates: { latitude: 22.3410655566561, longitude: 114.180221557617 },
        description: 'Christian Education Centre',
        imageUrl: 'https://Example.com/cec.jpg'
    },
    {
        id: 'hshc-sct',
        name: 'SCT',
        category: 'Study',
        coordinates: { latitude: 22.3405991512375, longitude: 114.179840683937 },
        description: 'Cha Chi-ming Science Tower',
        imageUrl: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'hshc-yss',
        name: 'YSS',
        category: 'Study',
        coordinates: { latitude: 22.3404106039232, longitude: 114.180307388306 },
        description: 'Yeung Shui Sang Building',
        imageUrl: 'https://Example.com/yss.jpg'
    },
    {
        id: 'hshc-fsc',
        name: 'FSC',
        category: 'Study',
        coordinates: { latitude: 22.3402270181354, longitude: 114.180060625076 },
        description: 'Fong Shu Chuen Library',
        imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'hshc-whs',
        name: 'WHS',
        category: 'Sports',
        coordinates: { latitude: 22.3394529781014, longitude: 114.18182015419 },
        description: 'Wai Hang Sports Centre',
        imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'hshc-sph',
        name: 'SPH',
        category: 'Other',
        coordinates: { latitude: 22.3404, longitude: 114.1805 },
        description: 'Shiu Pong Hall',
        imageUrl: 'https://Example.com/sph.jpg'
    },

    // Shaw Campus (SC)
    {
        id: 'sc-swt',
        name: 'SWT',
        category: 'Other',
        coordinates: { latitude: 22.3387880941286, longitude: 114.182029366493 },
        description: 'Shaw Tower',
        imageUrl: 'https://Example.com/swt.jpg'
    },
    {
        id: 'sc-aml',
        name: 'AML',
        category: 'Study',
        coordinates: { latitude: 22.3383365666379, longitude: 114.181991815567 },
        description: 'Au Shue Hung Memorial Library',
        imageUrl: 'https://Example.com/aml.jpg'
    },
    {
        id: 'sc-jsc',
        name: 'JSC',
        category: 'Sports',
        coordinates: { latitude: 22.3393487800764, longitude: 114.180843830109 },
        description: 'Joint Sports Centre',
        imageUrl: 'https://Example.com/jsc.jpg'
    },
    {
        id: 'sc-wlb',
        name: 'WLB',
        category: 'Study',
        coordinates: { latitude: 22.3377659528824, longitude: 114.181895256042 },
        description: 'The Wing Lung Bank Building',
        imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'sc-lw',
        name: 'LW',
        category: 'Other',
        coordinates: { latitude: 22.3374632785513, longitude: 114.181954264641 },
        description: 'Lam Woo International Conference Centre',
        imageUrl: 'https://Example.com/lw.jpg'
    },
    {
        id: 'sc-dlb',
        name: 'DLB',
        category: 'Study',
        coordinates: { latitude: 22.3370812132935, longitude: 114.181879162788 },
        description: 'David C. Lam Building',
        imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=500&q=60'
    },

    // Baptist University Road Campus (BURC)
    {
        id: 'burc-aab',
        name: 'AAB',
        category: 'Study',
        coordinates: { latitude: 22.3364312037613, longitude: 114.182351231575 },
        description: 'Academic and Admin Bldg',
        imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'burc-acc',
        name: 'ACC',
        category: 'Study',
        coordinates: { latitude: 22.3360243260236, longitude: 114.182597994804 },
        description: 'Jockey Club Academic Community Centre',
        imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'burc-scm',
        name: 'SCM',
        category: 'Study',
        coordinates: { latitude: 22.3356621045998, longitude: 114.182490706444 },
        description: 'Jockey Club SCM Bldg',
        imageUrl: 'https://Example.com/scm.jpg'
    },
    {
        id: 'burc-cva',
        name: 'CVA',
        category: 'Study',
        coordinates: { latitude: 22.3342132094962, longitude: 114.182361960411 },
        description: 'Comm. and Visual Arts',
        imageUrl: 'https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'burc-ntt',
        name: 'NTT',
        category: 'Other',
        coordinates: { latitude: 22.3362972319543, longitude: 114.181643128395 },
        description: 'Dr. Ng Tor Taihouse',
        imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'burc-srh',
        name: 'SRH',
        category: 'Other',
        coordinates: { latitude: 22.3351609473798, longitude: 114.18250143528 },
        description: 'Student Residence Halls',
        imageUrl: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=500&q=60'
    },
    {
        id: 'burc-scc',
        name: 'SCC',
        category: 'Sports',
        coordinates: { latitude: 22.3369869372897, longitude: 114.182415604591 },
        description: 'Madam Kwok Chung Bo Fun Ctr',
        imageUrl: 'https://Example.com/scc.jpg'
    },
    {
        id: 'fc',
        name: 'FC',
        category: 'Other',
        coordinates: { latitude: 22.3393487800764, longitude: 114.180843830109 },
        description: 'Franki Centre',
        imageUrl: ''
    },
    {
        id: 'sce',
        name: 'SCE',
        category: 'Other',
        coordinates: { latitude: 22.3360144021615, longitude: 114.18285548687 },
        description: 'School of Continuing Education',
        imageUrl: ''
    },
    {
        id: 'carpark-a',
        name: 'CARPARK A',
        category: 'Other',
        coordinates: { latitude: 22.3380338935454, longitude: 114.181653857231 },
        description: 'Carpark Area A',
        imageUrl: ''
    },
    {
        id: 'carpark-b',
        name: 'CARPARK B',
        category: 'Other',
        coordinates: { latitude: 22.3367140327087, longitude: 114.181970357895 },
        description: 'Carpark Area B',
        imageUrl: ''
    },
    {
        id: 'carpark-c',
        name: 'CARPARK C',
        category: 'Other',
        coordinates: { latitude: 22.3362525746568, longitude: 114.183230996132 },
        description: 'Carpark Area C',
        imageUrl: ''
    }
];

export const CAMPUS_BUILDINGS = BUILDINGS.filter((building) => !HIDDEN_BUILDING_IDS.has(building.id));

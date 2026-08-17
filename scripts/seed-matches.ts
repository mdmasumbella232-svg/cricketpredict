/**
 * Seed script: loads all 191 matches from IPL/PSL/BBL/CPL into the database.
 * Run: bun run scripts/seed-matches.ts
 */
import { db } from '../src/lib/db';

interface MatchSeed {
  id: string;
  leagueId: string;
  matchNo: number;
  date: string;
  teamAId: string;
  teamAScore: number;
  teamAWickets: number;
  teamAOvers: number;
  teamBId: string;
  teamBScore: number;
  teamBWickets: number;
  teamBOvers: number;
  winnerId: string;
  battingFirstId: string;
  note?: string;
}

const LEAGUES = [
  { id: 'IPL', name: 'IPL', fullName: 'Indian Premier League', country: 'India', season: '2026',
    bestSystem: 'Optimized-Weighted', bestAccuracy: 0.630,
    optimalWeights: JSON.stringify({ elo: 0.30, rr: 0.15, form: 0.10, wpct: 0.15, h2h: 0.10, momentum: 0.20 }) },
  { id: 'PSL', name: 'PSL', fullName: 'Pakistan Super League', country: 'Pakistan', season: '2026',
    bestSystem: 'Optimized-Weighted', bestAccuracy: 0.674,
    optimalWeights: JSON.stringify({ elo: 0.50, rr: 0.05, form: 0.05, wpct: 0.10, h2h: 0.15, momentum: 0.15 }) },
  { id: 'BBL', name: 'BBL', fullName: 'Big Bash League', country: 'Australia', season: '2025-26',
    bestSystem: 'Optimized-Weighted', bestAccuracy: 0.651,
    optimalWeights: JSON.stringify({ elo: 0.60, rr: 0.20, form: 0.20, wpct: 0.10, h2h: 0.05, momentum: 0.00 }) },
  { id: 'CPL', name: 'CPL', fullName: 'Caribbean Premier League', country: 'West Indies', season: '2025',
    bestSystem: 'Logistic Regression', bestAccuracy: 0.500,
    optimalWeights: JSON.stringify({ elo: 0.20, rr: 0.10, form: 0.20, wpct: 0.15, h2h: 0.05, momentum: 0.30 }) },
];

const TEAM_COLORS: Record<string, string> = {
  RCB: '#d32f2f', SRH: '#f57c00', MI: '#1976d2', KKR: '#6a1b9a', RR: '#e91e63',
  CSK: '#fbc02d', PBKS: '#c62828', GT: '#0288d1', LSG: '#00bfa5', DC: '#303f9f',
  LHQ: '#1976d2', HHK: '#d32f2f', QTG: '#7b1fa2', KRK: '#00838f', PSZ: '#f57c00',
  RWP: '#388e3c', MS: '#5d4037', ISU: '#512da8',
  PRS: '#f57c00', SYS: '#d32f2f', MLR: '#c62828', BRH: '#1976d2', HBH: '#512da8',
  SYT: '#00838f', ADS: '#388e3c', MLS: '#0288d1',
  SKNP: '#d32f2f', ABF: '#1976d2', GAW: '#388e3c', BT: '#7b1fa2', TKR: '#f57c00', SLK: '#00838f',
};

const TEAM_FULL_NAMES: Record<string, { name: string; fullName: string; city: string }> = {
  RCB: { name: 'RCB', fullName: 'Royal Challengers Bengaluru', city: 'Bengaluru' },
  SRH: { name: 'SRH', fullName: 'Sunrisers Hyderabad', city: 'Hyderabad' },
  MI: { name: 'MI', fullName: 'Mumbai Indians', city: 'Mumbai' },
  KKR: { name: 'KKR', fullName: 'Kolkata Knight Riders', city: 'Kolkata' },
  RR: { name: 'RR', fullName: 'Rajasthan Royals', city: 'Jaipur' },
  CSK: { name: 'CSK', fullName: 'Chennai Super Kings', city: 'Chennai' },
  PBKS: { name: 'PBKS', fullName: 'Punjab Kings', city: 'Mohali' },
  GT: { name: 'GT', fullName: 'Gujarat Titans', city: 'Ahmedabad' },
  LSG: { name: 'LSG', fullName: 'Lucknow Super Giants', city: 'Lucknow' },
  DC: { name: 'DC', fullName: 'Delhi Capitals', city: 'Delhi' },
  LHQ: { name: 'LHQ', fullName: 'Lahore Qalandars', city: 'Lahore' },
  HHK: { name: 'HHK', fullName: 'Hyderabad Hawks', city: 'Hyderabad' },
  QTG: { name: 'QTG', fullName: 'Quetta Gladiators', city: 'Quetta' },
  KRK: { name: 'KRK', fullName: 'Karachi Kings', city: 'Karachi' },
  PSZ: { name: 'PSZ', fullName: 'Peshawar Zalmi', city: 'Peshawar' },
  RWP: { name: 'RWP', fullName: 'Rawalpindi', city: 'Rawalpindi' },
  MS: { name: 'MS', fullName: 'Multan Sultans', city: 'Multan' },
  ISU: { name: 'ISU', fullName: 'Islamabad United', city: 'Islamabad' },
  PRS: { name: 'PRS', fullName: 'Perth Scorchers', city: 'Perth' },
  SYS: { name: 'SYS', fullName: 'Sydney Sixers', city: 'Sydney' },
  MLR: { name: 'MLR', fullName: 'Melbourne Renegades', city: 'Melbourne' },
  BRH: { name: 'BRH', fullName: 'Brisbane Heat', city: 'Brisbane' },
  HBH: { name: 'HBH', fullName: 'Hobart Hurricanes', city: 'Hobart' },
  SYT: { name: 'SYT', fullName: 'Sydney Thunder', city: 'Sydney' },
  ADS: { name: 'ADS', fullName: 'Adelaide Strikers', city: 'Adelaide' },
  MLS: { name: 'MLS', fullName: 'Melbourne Stars', city: 'Melbourne' },
  SKNP: { name: 'SKNP', fullName: 'St Kitts & Nevis Patriots', city: 'St Kitts' },
  ABF: { name: 'ABF', fullName: 'Antigua & Barbuda Falcons', city: 'Antigua' },
  GAW: { name: 'GAW', fullName: 'Guyana Amazon Warriors', city: 'Guyana' },
  BT: { name: 'BT', fullName: 'Barbados Royals', city: 'Barbados' },
  TKR: { name: 'TKR', fullName: 'Trinbago Knight Riders', city: 'Trinidad' },
  SLK: { name: 'SLK', fullName: 'Saint Lucia Kings', city: 'St Lucia' },
};

function ov(s: string | number): number {
  if (typeof s === 'number') return s;
  if (s.includes('.')) {
    const [w, b] = s.split('.');
    return parseInt(w) + parseInt(b) / 6;
  }
  return parseFloat(s);
}

// All 191 matches across 4 leagues (compact form: short codes)
// Format: [leagueId, matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, battingFirstId, note?]
type M = [string, number, string, string, number, number, string, string, number, number, string, string, string, string?];

const ALL_MATCHES: M[] = [
  // ===== IPL 2026 (74 matches, 1 abandoned) =====
  ['IPL',1,'Mar 28','RCB',203,4,'15.4','SRH',201,9,'20','RCB','SRH'],
  ['IPL',2,'Mar 29','MI',224,4,'19.1','KKR',220,4,'20','MI','KKR'],
  ['IPL',3,'Mar 30','RR',128,2,'12.1','CSK',127,10,'19.4','RR','CSK'],
  ['IPL',4,'Mar 31','PBKS',165,7,'19.1','GT',162,6,'20','PBKS','GT'],
  ['IPL',5,'Apr 1','DC',145,4,'17.1','LSG',141,10,'18.4','DC','LSG'],
  ['IPL',6,'Apr 2','KKR',161,10,'16','SRH',226,8,'20','SRH','SRH'],
  ['IPL',7,'Apr 3','CSK',209,5,'20','PBKS',210,5,'18.4','PBKS','CSK'],
  ['IPL',8,'Apr 4','DC',164,4,'18.1','MI',162,6,'20','DC','MI'],
  ['IPL',9,'Apr 4','GT',204,8,'20','RR',210,6,'20','RR','RR'],
  ['IPL',10,'Apr 5','SRH',156,9,'20','LSG',160,5,'19.5','LSG','SRH'],
  ['IPL',11,'Apr 5','RCB',250,3,'20','CSK',207,10,'19.4','RCB','RCB'],
  ['IPL',12,'Apr 6','KKR',25,2,'3.4','PBKS',0,0,'0','','','abandoned'],
  ['IPL',13,'Apr 7','RR',150,3,'11','MI',123,9,'11','RR','RR','reduced'],
  ['IPL',14,'Apr 8','DC',209,8,'20','GT',210,4,'20','GT','GT'],
  ['IPL',15,'Apr 9','KKR',181,4,'20','LSG',182,7,'20','LSG','KKR'],
  ['IPL',16,'Apr 10','RR',202,4,'18','RCB',201,8,'20','RR','RCB'],
  ['IPL',17,'Apr 11','PBKS',223,4,'18.5','SRH',219,6,'20','PBKS','SRH'],
  ['IPL',18,'Apr 11','CSK',212,2,'20','DC',189,10,'20','CSK','CSK'],
  ['IPL',19,'Apr 12','LSG',164,8,'20','GT',165,3,'18.4','GT','LSG'],
  ['IPL',20,'Apr 12','MI',222,5,'20','RCB',240,4,'20','RCB','MI'],
  ['IPL',21,'Apr 13','SRH',216,6,'20','RR',159,10,'19','SRH','SRH'],
  ['IPL',22,'Apr 14','CSK',192,5,'20','KKR',160,7,'20','CSK','CSK'],
  ['IPL',23,'Apr 15','RCB',149,5,'15.1','LSG',146,10,'20','RCB','LSG'],
  ['IPL',24,'Apr 16','MI',195,6,'20','PBKS',198,3,'16.3','PBKS','MI'],
  ['IPL',25,'Apr 17','GT',181,5,'19.4','KKR',180,10,'20','GT','KKR'],
  ['IPL',26,'Apr 18','RCB',175,8,'20','DC',179,4,'19.5','DC','RCB'],
  ['IPL',27,'Apr 18','SRH',194,9,'20','CSK',184,8,'20','SRH','SRH'],
  ['IPL',28,'Apr 19','KKR',161,6,'19.4','RR',155,9,'20','KKR','RR'],
  ['IPL',29,'Apr 19','PBKS',254,7,'20','LSG',200,5,'20','PBKS','PBKS'],
  ['IPL',30,'Apr 20','GT',100,10,'15.5','MI',199,5,'20','MI','MI'],
  ['IPL',31,'Apr 21','SRH',242,2,'20','DC',195,9,'20','SRH','SRH'],
  ['IPL',32,'Apr 22','LSG',119,10,'18','RR',159,6,'20','RR','RR'],
  ['IPL',33,'Apr 23','MI',104,10,'19','CSK',207,6,'20','CSK','CSK'],
  ['IPL',34,'Apr 24','RCB',206,5,'18.5','GT',205,3,'20','RCB','GT'],
  ['IPL',35,'Apr 25','DC',264,2,'20','PBKS',265,4,'18.5','PBKS','DC'],
  ['IPL',36,'Apr 25','RR',228,6,'20','SRH',229,5,'18.3','SRH','RR'],
  ['IPL',37,'Apr 26','CSK',158,7,'20','GT',162,2,'16.4','GT','CSK'],
  ['IPL',38,'Apr 26','LSG',155,8,'20','KKR',155,7,'20','KKR','LSG','super_over'],
  ['IPL',39,'Apr 27','DC',75,10,'16.3','RCB',77,1,'6.3','RCB','DC'],
  ['IPL',40,'Apr 28','PBKS',222,4,'20','RR',228,4,'19.2','RR','PBKS'],
  ['IPL',41,'Apr 29','MI',243,5,'20','SRH',249,4,'18.4','SRH','MI'],
  ['IPL',42,'Apr 30','GT',158,6,'15.5','RCB',155,10,'19.2','GT','RCB'],
  ['IPL',43,'May 1','RR',225,6,'20','DC',226,3,'19.1','DC','RR'],
  ['IPL',44,'May 2','CSK',160,2,'18.1','MI',159,7,'20','CSK','MI'],
  ['IPL',45,'May 3','SRH',165,10,'19','KKR',169,3,'18.2','KKR','SRH'],
  ['IPL',46,'May 3','GT',167,6,'19.5','PBKS',163,9,'20','GT','PBKS'],
  ['IPL',47,'May 4','MI',229,4,'18.4','LSG',228,5,'20','MI','LSG'],
  ['IPL',48,'May 5','DC',155,7,'20','CSK',159,2,'7.3','CSK','DC','reduced'],
  ['IPL',49,'May 6','SRH',235,4,'20','PBKS',202,7,'20','SRH','SRH'],
  ['IPL',50,'May 7','LSG',209,3,'19','RCB',203,6,'19','LSG','LSG','dls'],
  ['IPL',51,'May 8','DC',142,8,'20','KKR',147,2,'14.2','KKR','DC'],
  ['IPL',52,'May 9','RR',152,10,'16.3','GT',229,4,'20','GT','GT'],
  ['IPL',53,'May 10','CSK',208,5,'19.2','LSG',203,8,'20','CSK','LSG'],
  ['IPL',54,'May 10','RCB',167,8,'20','MI',166,7,'20','RCB','MI'],
  ['IPL',55,'May 11','PBKS',210,5,'20','DC',216,7,'19','DC','PBKS'],
  ['IPL',56,'May 12','GT',168,5,'20','SRH',86,10,'14.5','GT','GT'],
  ['IPL',57,'May 13','RCB',194,4,'19.1','KKR',192,4,'20','RCB','KKR'],
  ['IPL',58,'May 14','PBKS',200,8,'20','MI',205,4,'19.5','MI','PBKS'],
  ['IPL',59,'May 15','LSG',188,3,'16.4','CSK',187,5,'20','LSG','CSK'],
  ['IPL',60,'May 16','KKR',247,2,'20','GT',218,4,'20','KKR','GT'],
  ['IPL',61,'May 17','PBKS',199,8,'20','RCB',222,4,'20','RCB','PBKS'],
  ['IPL',62,'May 17','DC',197,5,'19.2','RR',193,8,'20','DC','RR'],
  ['IPL',63,'May 18','CSK',180,7,'20','SRH',181,5,'19','SRH','CSK'],
  ['IPL',64,'May 19','RR',225,3,'19.1','LSG',220,5,'20','RR','LSG'],
  ['IPL',65,'May 20','KKR',148,6,'18.5','MI',147,8,'20','KKR','MI'],
  ['IPL',66,'May 21','GT',229,4,'20','CSK',140,10,'13.4','GT','GT'],
  ['IPL',67,'May 22','SRH',255,4,'20','RCB',200,4,'20','SRH','SRH'],
  ['IPL',68,'May 23','LSG',196,6,'20','PBKS',200,3,'18','PBKS','LSG'],
  ['IPL',69,'May 24','MI',175,9,'20','RR',205,8,'20','RR','RR'],
  ['IPL',70,'May 24','KKR',163,10,'18.4','DC',203,5,'20','DC','DC'],
  ['IPL',71,'May 26','RCB',254,5,'20','GT',162,10,'19.3','RCB','RCB','Qualifier1'],
  ['IPL',72,'May 27','SRH',196,10,'19.2','RR',243,8,'20','RR','RR','Eliminator'],
  ['IPL',73,'May 29','GT',219,3,'18.4','RR',214,6,'20','GT','RR','Qualifier2'],
  ['IPL',74,'May 31','RCB',161,5,'18','GT',155,8,'20','RCB','GT','Final'],

  // ===== PSL 2026 (44 matches, 1 abandoned) =====
  ['PSL',1,'Mar 26','LHQ',199,6,'20','HHK',130,10,'20','LHQ','LHQ'],
  ['PSL',2,'Mar 27','QTG',167,7,'20','KRK',181,7,'20','KRK','KRK'],
  ['PSL',3,'Mar 28','PSZ',218,5,'19.1','RWP',214,4,'20','PSZ','RWP'],
  ['PSL',4,'Mar 28','MS',175,5,'18.4','ISU',171,8,'20','MS','ISU'],
  ['PSL',5,'Mar 29','QTG',174,8,'20','HHK',134,8,'20','QTG','QTG'],
  ['PSL',6,'Mar 29','LHQ',128,9,'20','KRK',131,6,'19.3','KRK','LHQ'],
  ['PSL',7,'Mar 31','ISU',0,0,'0','PSZ',0,0,'0','','','abandoned'],
  ['PSL',8,'Apr 1','MS',227,4,'18.4','HHK',225,5,'20','MS','HHK'],
  ['PSL',9,'Apr 2','QTG',183,5,'20','ISU',189,2,'18.2','ISU','QTG'],
  ['PSL',10,'Apr 2','RWP',197,6,'20','KRK',199,5,'19.2','KRK','RWP'],
  ['PSL',11,'Apr 3','LHQ',185,5,'13','MS',165,5,'13','LHQ','LHQ','reduced'],
  ['PSL',12,'Apr 4','RWP',156,7,'20','ISU',157,3,'14.2','ISU','RWP'],
  ['PSL',13,'Apr 5','QTG',166,7,'20','MS',167,4,'17.3','MS','QTG'],
  ['PSL',14,'Apr 6','MS',186,3,'16.2','RWP',182,8,'20','MS','RWP'],
  ['PSL',15,'Apr 8','HHK',145,10,'18.2','PSZ',146,6,'20','PSZ','HHK'],
  ['PSL',16,'Apr 9','LHQ',100,10,'18.3','ISU',104,1,'10.2','ISU','LHQ'],
  ['PSL',17,'Apr 9','KRK',87,10,'16.1','PSZ',246,3,'20','PSZ','PSZ'],
  ['PSL',18,'Apr 10','QTG',182,6,'20','RWP',121,10,'17.3','QTG','QTG'],
  ['PSL',19,'Apr 11','PSZ',173,7,'20','LHQ',97,10,'17','PSZ','PSZ'],
  ['PSL',20,'Apr 11','KRK',188,8,'20','HHK',189,6,'19.1','HHK','KRK'],
  ['PSL',21,'Apr 12','HHK',157,4,'18.1','ISU',153,9,'20','HHK','ISU'],
  ['PSL',22,'Apr 13','PSZ',196,6,'20','MS',172,8,'20','PSZ','PSZ'],
  ['PSL',23,'Apr 15','PSZ',156,2,'18.3','QTG',154,10,'20','PSZ','QTG'],
  ['PSL',24,'Apr 16','HHK',123,5,'16.3','RWP',121,9,'20','HHK','RWP'],
  ['PSL',25,'Apr 16','KRK',150,6,'20','ISU',153,2,'16','ISU','KRK'],
  ['PSL',26,'Apr 17','LHQ',134,10,'19.5','QTG',138,4,'16.2','QTG','LHQ'],
  ['PSL',27,'Apr 18','LHQ',210,4,'20','RWP',178,9,'20','LHQ','LHQ'],
  ['PSL',28,'Apr 19','KRK',196,10,'19.4','MS',207,7,'20','MS','MS'],
  ['PSL',29,'Apr 19','PSZ',255,3,'20','QTG',137,10,'18.1','PSZ','PSZ'],
  ['PSL',30,'Apr 21','LHQ',197,6,'20','QTG',188,7,'20','LHQ','LHQ'],
  ['PSL',31,'Apr 21','RWP',166,4,'20','MS',167,4,'18.4','MS','RWP'],
  ['PSL',32,'Apr 22','KRK',182,9,'20','PSZ',186,3,'18.5','PSZ','KRK'],
  ['PSL',33,'Apr 22','HHK',214,6,'19.3','MS',213,7,'20','HHK','MS'],
  ['PSL',34,'Apr 23','RWP',140,4,'18.1','ISU',137,10,'20','RWP','ISU'],
  ['PSL',35,'Apr 23','LHQ',199,6,'20','KRK',203,5,'18.4','KRK','LHQ'],
  ['PSL',36,'Apr 24','HHK',80,10,'15.5','ISU',83,2,'6.4','ISU','HHK'],
  ['PSL',37,'Apr 25','QTG',195,6,'20','KRK',199,1,'18.3','KRK','QTG'],
  ['PSL',38,'Apr 25','LHQ',200,4,'19.3','PSZ',199,4,'20','LHQ','PSZ'],
  ['PSL',39,'Apr 26','HHK',244,6,'20','RWP',136,10,'17.1','HHK','HHK'],
  ['PSL',40,'Apr 26','ISU',193,6,'18.4','MS',192,7,'20','ISU','MS'],
  ['PSL',41,'Apr 28','PSZ',221,7,'20','ISU',151,10,'18.4','PSZ','PSZ','Qualifier1'],
  ['PSL',42,'Apr 29','MS',159,9,'20','HHK',162,2,'15.2','HHK','MS','Eliminator'],
  ['PSL',43,'May 1','ISU',184,7,'20','HHK',186,5,'20','HHK','HHK','Qualifier2'],
  ['PSL',44,'May 3','PSZ',130,5,'15.2','HHK',129,10,'18','PSZ','HHK','Final'],

  // ===== BBL 2025-26 (44 matches, 1 abandoned) =====
  ['BBL',1,'Dec 14','PRS',117,5,'10.1','SYS',113,5,'11','PRS','SYS'],
  ['BBL',2,'Dec 15','MLR',212,5,'20','BRH',198,8,'20','MLR','MLR'],
  ['BBL',3,'Dec 16','HBH',181,6,'19.5','SYT',180,6,'20','HBH','SYT'],
  ['BBL',4,'Dec 17','SYS',159,9,'20','ADS',160,7,'19.2','ADS','SYS'],
  ['BBL',5,'Dec 18','MLS',159,2,'16','HBH',158,9,'20','MLS','HBH'],
  ['BBL',6,'Dec 19','BRH',258,2,'19.5','PRS',257,6,'20','BRH','PRS'],
  ['BBL',7,'Dec 20','SYT',151,10,'19.1','SYS',198,5,'20','SYS','SYS'],
  ['BBL',8,'Dec 21','MLR',145,9,'20','HBH',149,3,'13.5','HBH','MLR'],
  ['BBL',9,'Dec 22','SYT',193,4,'20','BRH',159,6,'20','SYT','SYT'],
  ['BBL',10,'Dec 23','ADS',155,8,'20','MLS',161,4,'18.1','MLS','ADS'],
  ['BBL',11,'Dec 26','SYS',144,10,'20','MLS',145,3,'17.3','MLS','SYS'],
  ['BBL',12,'Dec 27','PRS',150,8,'20','HBH',153,6,'19.3','HBH','PRS'],
  ['BBL',13,'Dec 27','BRH',179,9,'20','ADS',172,10,'19.5','BRH','BRH'],
  ['BBL',14,'Dec 28','MLS',132,1,'14','SYT',128,10,'20','MLS','SYT'],
  ['BBL',15,'Dec 29','HBH',163,6,'19','MLR',162,9,'20','HBH','MLR'],
  ['BBL',16,'Dec 30','SYT',131,10,'17.3','PRS',202,8,'20','PRS','SYT'],
  ['BBL',17,'Dec 31','ADS',125,3,'14.1','BRH',121,10,'19.4','ADS','BRH'],
  ['BBL',18,'Jan 1','MLR',164,9,'20','SYS',168,4,'19.1','SYS','MLR'],
  ['BBL',19,'Jan 1','HBH',189,9,'20','PRS',229,3,'20','PRS','HBH'],
  ['BBL',20,'Jan 2','BRH',199,6,'19.4','MLS',195,6,'20','BRH','MLS'],
  ['BBL',21,'Jan 3','SYT',205,4,'20','HBH',207,4,'17.5','HBH','SYT'],
  ['BBL',22,'Jan 4','MLS',173,9,'20','MLR',177,6,'19.5','MLR','MLS'],
  ['BBL',23,'Jan 4','PRS',153,8,'20','ADS',120,10,'18.1','PRS','PRS'],
  ['BBL',24,'Jan 5','SYS',118,7,'18.4','BRH',114,9,'20','SYS','BRH'],
  ['BBL',25,'Jan 6','ADS',165,8,'20','SYT',159,7,'20','ADS','ADS'],
  ['BBL',26,'Jan 7','PRS',127,10,'19.2','MLR',130,6,'20','MLR','PRS'],
  ['BBL',27,'Jan 8','MLS',128,10,'19.5','SYS',129,4,'17.1','SYS','MLS'],
  ['BBL',28,'Jan 9','HBH',178,6,'20','ADS',141,9,'20','HBH','HBH'],
  ['BBL',29,'Jan 10','BRH',183,3,'16.2','SYT',180,6,'20','BRH','SYT'],
  ['BBL',30,'Jan 10','MLR',166,7,'20','MLS',170,2,'15.5','MLS','MLR'],
  ['BBL',31,'Jan 11','SYS',32,0,'5','HBH',0,0,'0','','','abandoned'],
  ['BBL',32,'Jan 11','ADS',200,8,'20','PRS',232,4,'20','PRS','ADS'],
  ['BBL',33,'Jan 12','SYT',140,6,'15.2','MLR',170,8,'20','SYT','MLR','dls'],
  ['BBL',34,'Jan 13','MLS',86,4,'15.1','ADS',83,10,'19.3','MLS','ADS'],
  ['BBL',35,'Jan 14','HBH',157,8,'20','BRH',160,8,'20','BRH','HBH'],
  ['BBL',36,'Jan 15','MLR',169,7,'20','PRS',219,7,'20','PRS','MLR'],
  ['BBL',37,'Jan 16','SYS',191,5,'17.2','SYT',189,6,'20','SYS','SYT'],
  ['BBL',38,'Jan 17','ADS',100,2,'11.5','MLR',99,10,'16.5','ADS','MLR'],
  ['BBL',39,'Jan 17','PRS',134,4,'16.5','MLS',130,10,'18.2','PRS','MLS'],
  ['BBL',40,'Jan 18','BRH',171,9,'20','SYS',177,5,'18.4','SYS','BRH'],
  ['BBL',41,'Jan 20','PRS',147,9,'20','SYS',99,10,'15','PRS','PRS','Qualifier1'],
  ['BBL',42,'Jan 21','HBH',114,5,'10','MLS',81,4,'7','HBH','MLS','Knockout-dls'],
  ['BBL',43,'Jan 23','SYS',198,8,'20','HBH',141,10,'17.2','SYS','SYS','Challenger'],
  ['BBL',44,'Jan 25','PRS',133,4,'17.3','SYS',132,10,'20','PRS','SYS','Final'],

  // ===== CPL 2025 (34 matches, 2 abandoned/no-result) =====
  ['CPL',1,'Aug 15','SKNP',125,4,'15','ABF',121,10,'17.1','SKNP','ABF'],
  ['CPL',2,'Aug 16','SKNP',153,8,'20','GAW',154,5,'17.2','GAW','SKNP'],
  ['CPL',3,'Aug 17','ABF',152,4,'19.4','BT',151,6,'20','ABF','BT'],
  ['CPL',4,'Aug 17','SKNP',219,7,'20','TKR',231,5,'20','TKR','TKR'],
  ['CPL',5,'Aug 18','ABF',0,0,'0','SLK',0,0,'0','','','abandoned'],
  ['CPL',6,'Aug 20','SKNP',197,6,'20','SLK',200,8,'20','SLK','SLK'],
  ['CPL',7,'Aug 21','ABF',167,6,'20','TKR',159,6,'20','ABF','ABF'],
  ['CPL',8,'Aug 22','SKNP',174,8,'20','BT',162,10,'18.2','SKNP','SKNP'],
  ['CPL',9,'Aug 23','ABF',128,10,'15.2','GAW',211,3,'20','GAW','GAW'],
  ['CPL',10,'Aug 24','SLK',165,6,'20','TKR',183,7,'20','TKR','TKR'],
  ['CPL',11,'Aug 24','ABF',137,3,'19.4','SKNP',133,9,'20','ABF','SKNP'],
  ['CPL',12,'Aug 25','SLK',0,0,'0','BT',0,0,'0','','','no_result'],
  ['CPL',13,'Aug 27','SLK',203,6,'18.1','GAW',202,6,'20','SLK','GAW'],
  ['CPL',14,'Aug 28','TKR',152,2,'18.4','ABF',146,7,'20','TKR','ABF'],
  ['CPL',15,'Aug 29','SLK',180,3,'17','SKNP',177,3,'20','SLK','SKNP'],
  ['CPL',16,'Aug 30','TKR',179,3,'17.5','BT',178,6,'20','TKR','BT'],
  ['CPL',17,'Aug 31','TKR',169,4,'17.2','GAW',163,9,'20','TKR','GAW'],
  ['CPL',18,'Aug 31','SLK',206,4,'17.5','ABF',204,4,'20','SLK','ABF'],
  ['CPL',19,'Sep 1','TKR',179,6,'20','SKNP',167,6,'20','TKR','TKR'],
  ['CPL',20,'Sep 4','TKR',109,10,'18.1','SLK',112,3,'11.1','SLK','TKR'],
  ['CPL',21,'Sep 5','BT',165,6,'20','GAW',170,6,'19.4','GAW','BT'],
  ['CPL',22,'Sep 6','BT',187,4,'20','ABF',188,6,'20','ABF','BT'],
  ['CPL',23,'Sep 7','GAW',168,7,'19.5','TKR',167,5,'20','GAW','TKR'],
  ['CPL',24,'Sep 7','BT',191,5,'20','SLK',164,9,'20','BT','BT'],
  ['CPL',25,'Sep 8','GAW',144,8,'20','SKNP',149,6,'20','SKNP','SKNP'],
  ['CPL',26,'Sep 11','GAW',99,10,'18.1','ABF',103,6,'19.1','ABF','GAW'],
  ['CPL',27,'Sep 12','BT',149,7,'20','SKNP',150,7,'20','SKNP','SKNP'],
  ['CPL',28,'Sep 13','BT',172,3,'19','TKR',166,8,'20','BT','TKR'],
  ['CPL',29,'Sep 13','GAW',188,8,'20','SLK',185,4,'20','GAW','SLK'],
  ['CPL',30,'Sep 15','GAW',189,6,'20','BT',125,10,'18.2','GAW','GAW'],
  ['CPL',31,'Sep 17','TKR',168,1,'17.3','ABF',166,8,'20','TKR','ABF','Eliminator1'],
  ['CPL',32,'Sep 18','SLK',143,10,'19.1','GAW',157,10,'19.5','GAW','GAW','Qualifier1'],
  ['CPL',33,'Sep 20','TKR',194,4,'20','SLK',138,8,'20','TKR','TKR','Qualifier2'],
  ['CPL',34,'Sep 22','GAW',130,8,'20','TKR',133,7,'18','TKR','GAW','Final'],
];

async function main() {
  console.log('Seeding cricket prediction database...');

  // Clean up
  await db.prediction.deleteMany();
  await db.match.deleteMany();
  await db.team.deleteMany();
  await db.league.deleteMany();
  console.log('Cleared existing data.');

  // Insert leagues
  for (const lg of LEAGUES) {
    await db.league.create({
      data: {
        id: lg.id,
        name: lg.name,
        fullName: lg.fullName,
        country: lg.country,
        season: lg.season,
        bestSystem: lg.bestSystem,
        bestAccuracy: lg.bestAccuracy,
        optimalWeights: lg.optimalWeights,
      },
    });
  }
  console.log(`Inserted ${LEAGUES.length} leagues.`);

  // Collect teams per league
  const teamsPerLeague: Record<string, Set<string>> = {};
  for (const m of ALL_MATCHES) {
    const [leagueId, , , teamA, , , , teamB, , , , winner] = m;
    if (!teamsPerLeague[leagueId]) teamsPerLeague[leagueId] = new Set();
    if (teamA && winner) teamsPerLeague[leagueId].add(teamA);
    if (teamB && winner) teamsPerLeague[leagueId].add(teamB);
  }

  // Insert teams
  let teamCount = 0;
  for (const leagueId of Object.keys(teamsPerLeague)) {
    for (const teamId of teamsPerLeague[leagueId]) {
      const info = TEAM_FULL_NAMES[teamId] || { name: teamId, fullName: teamId, city: null };
      await db.team.create({
        data: {
          id: `${leagueId}_${teamId}`,
          name: info.name,
          fullName: info.fullName,
          city: info.city,
          color: TEAM_COLORS[teamId] || '#888888',
          leagueId,
        },
      });
      teamCount++;
    }
  }
  console.log(`Inserted ${teamCount} teams.`);

  // Insert matches (only those with a result)
  let matchCount = 0;
  for (const m of ALL_MATCHES) {
    const [leagueId, matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, batFirst, note] = m;
    if (!winner) continue; // skip abandoned

    await db.match.create({
      data: {
        id: `${leagueId}_${matchNo}`,
        leagueId,
        matchNo,
        date,
        teamAId: `${leagueId}_${teamA}`,
        teamAScore: aRuns,
        teamAWickets: aWk,
        teamAOvers: ov(aOv),
        teamBId: `${leagueId}_${teamB}`,
        teamBScore: bRuns,
        teamBWickets: bWk,
        teamBOvers: ov(bOv),
        winnerId: `${leagueId}_${winner}`,
        battingFirstId: batFirst ? `${leagueId}_${batFirst}` : null,
        note: note || null,
      },
    });
    matchCount++;
  }
  console.log(`Inserted ${matchCount} matches.`);

  // Now walk-forward compute predictions + final team states
  // Import the engine
  const { initTeamState, applyMatchResult, predictAllSystems, LEAGUE_WEIGHTS } = await import('../src/lib/prediction-engine');

  const statesByLeague: Record<string, Record<string, ReturnType<typeof initTeamState>>> = {};
  for (const leagueId of Object.keys(teamsPerLeague)) {
    statesByLeague[leagueId] = {};
    for (const teamId of teamsPerLeague[leagueId]) {
      statesByLeague[leagueId][`${leagueId}_${teamId}`] = initTeamState(`${leagueId}_${teamId}`);
    }
  }

  // Walk forward, generating predictions BEFORE each match's state is updated
  let predCount = 0;
  for (const m of ALL_MATCHES) {
    const [leagueId, matchNo, date, teamA, aRuns, aWk, aOv, teamB, bRuns, bWk, bOv, winner, batFirst, note] = m;
    if (!winner) continue;

    const teamAId = `${leagueId}_${teamA}`;
    const teamBId = `${leagueId}_${teamB}`;
    const states = statesByLeague[leagueId];

    // Generate predictions BEFORE applying this match's result
    // (skip if either team has 0 matches - not enough state to predict meaningfully, but we still record for completeness)
    if (states[teamAId].matches > 0 || states[teamBId].matches > 0) {
      const preds = predictAllSystems(states[teamAId], states[teamBId], leagueId);
      const aWon = winner === teamA;
      for (const p of preds) {
        await db.prediction.create({
          data: {
            matchId: `${leagueId}_${matchNo}`,
            teamAId,
            teamBId,
            system: p.system,
            probA: p.probA,
            correct: (p.probA > 0.5) === aWon,
          },
        });
        predCount++;
      }
    }

    // Apply result
    applyMatchResult(states, {
      matchNo,
      date,
      teamAId,
      teamAScore: aRuns,
      teamAWickets: aWk,
      teamAOvers: ov(aOv),
      teamBId,
      teamBScore: bRuns,
      teamBWickets: bWk,
      teamBOvers: ov(bOv),
      winnerId: `${leagueId}_${winner}`,
      battingFirstId: `${leagueId}_${batFirst}`,
      note,
    });
  }
  console.log(`Generated ${predCount} predictions.`);

  // Persist final team states to DB
  for (const leagueId of Object.keys(statesByLeague)) {
    for (const teamId of Object.keys(statesByLeague[leagueId])) {
      const s = statesByLeague[leagueId][teamId];
      await db.team.update({
        where: { id: teamId },
        data: {
          elo: s.elo,
          matches: s.matches,
          wins: s.wins,
          totalRunsScored: s.totalRunsScored,
          totalBallsFaced: s.totalBallsFaced,
          totalWicketsLost: s.totalWicketsLost,
          totalRunsConceded: s.totalRunsConceded,
          totalBallsBowled: s.totalBallsBowled,
          totalWicketsTaken: s.totalWicketsTaken,
          battingFirstMatches: s.battingFirstMatches,
          battingFirstWins: s.battingFirstWins,
          chasingMatches: s.chasingMatches,
          chasingWins: s.chasingWins,
          battingFirstTotalRuns: s.battingFirstTotalRuns,
          chasingTotalRuns: s.chasingTotalRuns,
          recentForm: JSON.stringify(s.recentForm),
          h2h: JSON.stringify(s.h2h),
        },
      });
    }
  }
  console.log('Team states persisted.');

  // Print summary
  for (const leagueId of Object.keys(statesByLeague)) {
    const league = LEAGUES.find((l) => l.id === leagueId);
    const teams = Object.values(statesByLeague[leagueId]).sort((a, b) => b.elo - a.elo);
    console.log(`\n=== ${league?.fullName} ${league?.season} ===`);
    for (const t of teams) {
      console.log(`  ${t.id.replace(leagueId + '_', '')}: ELO=${t.elo.toFixed(0)} M=${t.matches} W=${t.wins}`);
    }
  }
  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

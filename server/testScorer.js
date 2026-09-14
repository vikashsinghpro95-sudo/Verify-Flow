import { calculateScoreAndStatus } from './services/riskScorer.js';

const result = {
  syntaxValid: true,
  domainValid: true,
  mxValid: true,
  disposable: false,
  catchAll: false,
  roleBased: false,
  smtpStatus: '5xx',
  smtpMessage: '550 5.7.1 Service unavailable, Client host [36.255.168.22] blocked using Spamhaus.'
};

console.log(calculateScoreAndStatus(result));

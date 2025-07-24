// src/utils/winston.js
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  // Hapus transport yang menulis ke file
  // transports: [ new DailyRotateFile(...) ],
  // Cukup gunakan transport Console
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export default logger;
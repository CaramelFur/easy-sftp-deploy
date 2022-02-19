import 'colors';

export type SftpLogColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'grey';

export type SftpLogStyle =
  | 'reset'
  | 'bold'
  | 'dim'
  | 'italic'
  | 'underline'
  | 'inverse'
  | 'hidden'
  | 'strikethrough';

export type SftpLogType = 'info' | 'error';

type SftpLoggerOptions = {
  color?: SftpLogColor;
  style?: SftpLogStyle;
  type?: SftpLogType;
};

export type SftpLoggerType = (msg: string, options?: SftpLoggerOptions) => void;

function typeLog(msg: any, SftpLogType: SftpLogType = 'info') {
  if (SftpLogType === 'error') {
    return console.error(msg);
  }
  return console.info(msg);
}

export function SftpLogger(msg: string, options?: SftpLoggerOptions) {
  if (!options?.color && options?.type) {
    if (options.type === 'error') options.color = 'red';
  }

  if (options?.color && options?.style) {
    typeLog(msg[options.color][options.style], options.type);
  } else if (options?.color) {
    typeLog(msg[options.color], options.type);
  } else if (options?.style) {
    typeLog(msg[options.style], options.type);
  } else {
    typeLog(msg, options?.type);
  }
}

export function SftpLoggerNoColor(msg: string, options?: SftpLoggerOptions) {
  typeLog(msg, options?.type);
}

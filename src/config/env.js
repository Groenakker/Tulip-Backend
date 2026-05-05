/**
 * Environment variable validation and configuration
 * Validates all required environment variables at startup
 */

const requiredEnvVars = {
  MONGODB_URI: {
    name: 'MONGODB_URI',
    description: 'MongoDB connection string',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'MongoDB connection string is required';
      }
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        return 'MongoDB URI must start with mongodb:// or mongodb+srv://';
      }
      return null;
    }
  },
  REDIS_URL: {
    name: 'REDIS_URL',
    description: 'Redis connection URL',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'Redis URL is required';
      }
      // Redis URL can be redis:// or rediss:// (SSL)
      if (!value.startsWith('redis://') && !value.startsWith('rediss://')) {
        return 'Redis URL must start with redis:// or rediss://';
      }
      return null;
    }
  },
  SUPABASE_URL: {
    name: 'SUPABASE_URL',
    description: 'Supabase project URL',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'Supabase URL is required';
      }
      try {
        new URL(value);
      } catch {
        return 'Supabase URL must be a valid URL';
      }
      return null;
    }
  },
  SUPABASE_KEY: {
    name: 'SUPABASE_KEY',
    description: 'Supabase anon/public key',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'Supabase key is required';
      }
      return null;
    }
  },
  JWT_SECRET: {
    name: 'JWT_SECRET',
    description: 'JWT secret key for token signing',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'JWT secret is required';
      }
      // if (value.length < 32) {
      //   return 'JWT secret must be at least 32 characters long for security';
      // }
      return null;
    }
  },
  EMAIL_USER: {
    name: 'EMAIL_USER',
    description: 'Email address for sending emails',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'Email user is required';
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Email user must be a valid email address';
      }
      return null;
    }
  },
  EMAIL_PASS: {
    name: 'EMAIL_PASS',
    description: 'Email password or app password',
    validate: (value) => {
      if (!value || typeof value !== 'string' || value.trim() === '') {
        return 'Email password is required';
      }
      return null;
    }
  }
};

const optionalEnvVars = {
  PORT: {
    name: 'PORT',
    default: 3000,
    description: 'Server port number',
    validate: (value) => {
      const port = parseInt(value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return 'PORT must be a number between 1 and 65535';
      }
      return null;
    }
  },
  NODE_ENV: {
    name: 'NODE_ENV',
    default: 'development',
    description: 'Node environment (development, production, test)',
    validate: (value) => {
      const validEnvs = ['development', 'production', 'test'];
      if (value && !validEnvs.includes(value)) {
        return `NODE_ENV must be one of: ${validEnvs.join(', ')}`;
      }
      return null;
    }
  },
  FRONTEND_URL: {
    name: 'FRONTEND_URL',
    default: '',
    description: 'Frontend URL for CORS',
    validate: (value) => {
      if (value && value.trim() !== '') {
        try {
          new URL(value);
        } catch {
          return 'FRONTEND_URL must be a valid URL if provided';
        }
      }
      return null;
    }
  },
  CLIENT_BASE_URL: {
    name: 'CLIENT_BASE_URL',
    default: '',
    description: 'Client base URL for redirects',
    validate: (value) => {
      if (value && value.trim() !== '') {
        try {
          new URL(value);
        } catch {
          return 'CLIENT_BASE_URL must be a valid URL if provided';
        }
      }
      return null;
    }
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    default: '',
    description: 'Supabase service role key (optional, for admin operations)',
    validate: (value) => {
      // Optional, no validation needed if empty
      return null;
    }
  },
  SHIPPO_API_TOKEN: {
    name: 'SHIPPO_API_TOKEN',
    default: '',
    description: 'Shippo API token (shippo_test_* or shippo_live_*). Required for Shippo features.',
    validate: (value) => {
      if (value && value.trim() !== '' && !/^shippo_(test|live)_/.test(value)) {
        return 'SHIPPO_API_TOKEN should start with shippo_test_ or shippo_live_';
      }
      return null;
    }
  },
  SHIPPO_API_VERSION: { name: 'SHIPPO_API_VERSION', default: '', description: 'Shippo API version header', validate: () => null },
  SHIPPO_FROM_NAME: { name: 'SHIPPO_FROM_NAME', default: '', description: 'Default ship-from name', validate: () => null },
  SHIPPO_FROM_COMPANY: { name: 'SHIPPO_FROM_COMPANY', default: '', description: 'Default ship-from company', validate: () => null },
  SHIPPO_FROM_STREET1: { name: 'SHIPPO_FROM_STREET1', default: '', description: 'Default ship-from street', validate: () => null },
  SHIPPO_FROM_STREET2: { name: 'SHIPPO_FROM_STREET2', default: '', description: 'Default ship-from street 2', validate: () => null },
  SHIPPO_FROM_CITY: { name: 'SHIPPO_FROM_CITY', default: '', description: 'Default ship-from city', validate: () => null },
  SHIPPO_FROM_STATE: { name: 'SHIPPO_FROM_STATE', default: '', description: 'Default ship-from state', validate: () => null },
  SHIPPO_FROM_ZIP: { name: 'SHIPPO_FROM_ZIP', default: '', description: 'Default ship-from zip', validate: () => null },
  SHIPPO_FROM_COUNTRY: { name: 'SHIPPO_FROM_COUNTRY', default: 'US', description: 'Default ship-from country ISO-2', validate: () => null },
  SHIPPO_FROM_PHONE: { name: 'SHIPPO_FROM_PHONE', default: '', description: 'Default ship-from phone', validate: () => null },
  SHIPPO_FROM_EMAIL: { name: 'SHIPPO_FROM_EMAIL', default: '', description: 'Default ship-from email', validate: () => null },
  SHIPPO_DEFAULT_PARCEL_LENGTH: { name: 'SHIPPO_DEFAULT_PARCEL_LENGTH', default: '10', description: 'Default parcel length', validate: () => null },
  SHIPPO_DEFAULT_PARCEL_WIDTH: { name: 'SHIPPO_DEFAULT_PARCEL_WIDTH', default: '8', description: 'Default parcel width', validate: () => null },
  SHIPPO_DEFAULT_PARCEL_HEIGHT: { name: 'SHIPPO_DEFAULT_PARCEL_HEIGHT', default: '4', description: 'Default parcel height', validate: () => null },
  SHIPPO_DEFAULT_PARCEL_DISTANCE_UNIT: { name: 'SHIPPO_DEFAULT_PARCEL_DISTANCE_UNIT', default: 'in', description: 'Distance unit: in or cm', validate: () => null },
  SHIPPO_DEFAULT_PARCEL_WEIGHT: { name: 'SHIPPO_DEFAULT_PARCEL_WEIGHT', default: '2', description: 'Default parcel weight', validate: () => null },
  SHIPPO_DEFAULT_PARCEL_MASS_UNIT: { name: 'SHIPPO_DEFAULT_PARCEL_MASS_UNIT', default: 'lb', description: 'Mass unit: lb, oz, kg, g', validate: () => null },
  SHIPPO_LABEL_FILE_TYPE: {
    name: 'SHIPPO_LABEL_FILE_TYPE',
    default: 'PDF_4x6',
    description: 'Preferred Shippo label file type',
    validate: (value) => {
      if (!value) return null;
      const allowed = ['PDF', 'PDF_4x6', 'PDF_4x8', 'PNG', 'PNG_2.3x7.5', 'ZPLII'];
      if (!allowed.includes(value)) {
        return `SHIPPO_LABEL_FILE_TYPE must be one of: ${allowed.join(', ')}`;
      }
      return null;
    }
  }
};

/**
 * Validate environment variables
 * Throws an error if validation fails
 */
export const validateEnv = () => {
  const errors = [];
  const config = {};

  // Validate required environment variables
  for (const [key, schema] of Object.entries(requiredEnvVars)) {
    const value = process.env[key];
    const error = schema.validate(value);

    if (error) {
      errors.push(`  - ${schema.name}: ${error}`);
    } else {
      config[key] = value;
    }
  }

  // Validate optional environment variables and set defaults
  for (const [key, schema] of Object.entries(optionalEnvVars)) {
    const value = process.env[key];

    if (value !== undefined && value !== null && value !== '') {
      const error = schema.validate(value);
      if (error) {
        errors.push(`  - ${schema.name}: ${error}`);
      } else {
        config[key] = value;
      }
    } else if (schema.default !== undefined) {
      config[key] = schema.default;
    }
  }

  // If there are validation errors, throw with detailed message
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment variable validation failed:',
      '',
      ...errors,
      '',
      'Please check your .env file and ensure all required variables are set correctly.'
    ].join('\n');

    console.error(errorMessage);
    process.exit(1);
  }

  // Log success message (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Environment variables validated successfully');
  }

  return config;
};

/**
 * Get validated environment configuration
 * This function should be called after dotenv.config() in the main entry point
 */
export const getEnvConfig = () => {
  return validateEnv();
};

export default {
  validateEnv,
  getEnvConfig
};


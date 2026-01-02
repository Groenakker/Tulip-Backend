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


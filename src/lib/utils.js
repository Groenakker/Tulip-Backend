import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    maxAge: 3600000, // 1 hour
    httpOnly: true,
    secure: isProduction,                     // true on HTTPS in prod
    sameSite: isProduction ? 'None' : 'Lax',  // None for cross-site, Lax/Strict for localhost
  });

  return token;
};

export const verifyToken = (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
}

// Decode token without verification (for refresh endpoint)
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
}

// Verify token with optional expiration check (for refresh)
export const verifyTokenForRefresh = (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    // Try to verify the token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (verifyError) {
      // If token is expired, try to decode it anyway to get userId
      if (verifyError.name === 'TokenExpiredError') {
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) {
          // Allow refresh if token is expired but valid format
          req.userId = decoded.userId;
          req.tokenExpired = true;
          next();
        } else {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
      } else {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
}

const jwt = require("jsonwebtoken");
const User = require("../model/UserModel");
const Permission = require("../model/PermissionModel");

const authenticateToken = async (req, res, next) => {
    try {
        let token = req.headers["authorization"];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please provide token"
            });
        }

        token = token.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Invalid token format"
            });
        }

        // Verify JWT token
        const decodedToken = jwt.verify(token, process.env.JWT_KEY);

        const { role } = decodedToken;

        // Check user in database
        const user = await User.findOne({
            _id: decodedToken.userId,
            isDeleted: false,
            isActive: true
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Invalid User Token"
            });
        }

        if (role === undefined) {
            return res.status(403).json({
                success: false,
                message: "Invalid role ID"
            });
        }

        const routePath = req.path;
        const formattedRoutePath = routePath.split("/")[1];

        const permission = await Permission.findOne({
            menuKey: formattedRoutePath
        });

        if (permission && permission.roleId.includes(role)) {
            req.name = user.name;
            req.userId = user._id;
            req.driverId =
                user.role === 2 || user.role === 1 ? user._id : null;
            req.role = user.role;

            return next();
        }

        return res.status(403).json({
            success: false,
            message: "Access Denied"
        });

    } catch (error) {
        // Handle expired token
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                tokenExpired: true,
                message: "Your session has expired. Please login again."
            });
        }

        // Handle invalid token
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                tokenExpired: false,
                message: "Invalid authentication token"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Authentication failed"
        });
    }
};

module.exports = authenticateToken;

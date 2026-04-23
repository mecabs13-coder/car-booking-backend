const jwt = require("jsonwebtoken");
const User = require("../model/UserModel");
const Permission = require("../model/PermissionModel");

const authenticateToken = async (req, res, next) => { // Make the function async
    try {
        let token = req.headers['authorization'];
        if (token) {
            token = token.split(' ')[1];
            const decodedToken = await jwt.verify(token, process.env.JWT_KEY); // Use await here

            const { role } = decodedToken;
            const user = await User.findOne({ _id: decodedToken.userId, isDeleted: false, isActive: true }); // Fetch user from DB
            if (!user) {
                return res.status(404).json({ error: "Invalid User Token" });
            }
            if (role !== undefined) {
                const routePath = req.path;
                const formattedRoutePath = routePath.split('/')[1];
                const permission = await Permission.findOne({ menuKey: formattedRoutePath });
                if (permission && permission.roleId.includes(role)) {
                    req.name = user.name;
                    req.userId = user._id;
                    req.driverId = user.role === 2 || user.role === 1 ? user._id : null;
                    req.role = user.role;
                    next();
                } else {
                    // User does not have permission, deny access
                    return res.status(403).json({ error: "Access Denied" });
                }
            } else {
                res.status(403).send({ result: "Invalid role ID please provide valid ID" });
            }
        } else {
            res.status(403).send({ result: "Please provide token" });
        }
    } catch (error) {
        console.log(error);
        res.status(401).send({ result: "Please provide valid token" });
    }
};

module.exports = authenticateToken;
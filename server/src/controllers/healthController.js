export const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    service: "Vision Forge API",
    status: "online",
    timestamp: new Date().toISOString(),
  });
};

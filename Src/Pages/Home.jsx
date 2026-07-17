import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <h1 className="text-5xl font-bold text-green-700 mb-3">
          🎮 UNO Pro Online
        </h1>

        <p className="text-gray-600 mb-6">
          Play UNO online with friends anywhere in the world.
        </p>

        <Button className="w-full mb-4" onClick={() => navigate("/create")}>
          Create Room
        </Button>

        <Button
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          onClick={() => navigate("/join")}
        >
          Join Room
        </Button>
      </Card>
    </div>
  );
}

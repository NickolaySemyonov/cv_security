import asyncio
from dataclasses import field
from datetime import datetime

import asyncpg
from pydantic.dataclasses import dataclass

from src.config.settings import Settings


@dataclass
class AreaData:
    id: int
    disabled: bool
    type: str


@dataclass
class AreaConfig:
    areas: dict[int, AreaData] = field(default_factory=dict)

    def add_area(self, area: AreaData):
        self.areas[area.id] = area

    def get_area(self, area_id):
        if area_id is None:
            return None

        return self.areas[area_id]


class ConfigWatcher:
    def __init__(self, callback, settings: Settings, poll_interval: float = 5.0):
        self.callback = callback
        self.settings = settings

        self.poll_interval = poll_interval
        self._current_config = None
        self._stopped = False

    async def start(self):

        while not self._stopped:
            try:
                new_config = await self._poll_config()

                if self._current_config != new_config:
                    await self.callback(new_config)
                    self._current_config = new_config

                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(e)
                break

    def stop(self):
        self._stopped = True

    async def _poll_config(self):
        print(f"polling area config at {datetime.now()}")

        area_config: AreaConfig = AreaConfig()
        conn = await asyncpg.connect(
            host=self.settings.postgres_host,
            port=self.settings.postgres_port,
            database=self.settings.postgres_db,
            user=self.settings.postgres_user,
            password=self.settings.postgres_password
        )
        try:
            rows = await conn.fetch("SELECT id, disabled, type FROM area")
            if not rows:
                return
            for row in rows:
                area_config.add_area(AreaData(row[0], row[1], row[2]))

        except Exception as e:
            print(f"[DB] Exception: {e}")
        finally:
            await conn.close()

        return area_config

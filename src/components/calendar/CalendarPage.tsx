import { useState, useMemo } from "react";
import { MultiOptionCalendar } from "./MultiOptionCalendar";
import { api } from "~/utils/api";
import { useToast } from "~/hooks/useToast";
import { MdRefresh, MdChevronLeft, MdChevronRight } from "react-icons/md";
import { calendarsConfig, allActivityKeys } from "~/config/calendars";

type ActivityData = { date: string } & Record<string, string | number>;

interface CalendarPageProps {
	initialActivities: ActivityData[];
}

export default function CalendarPage({ initialActivities }: CalendarPageProps) {
	const [currentDate, setCurrentDate] = useState(new Date());
	const year = currentDate.getFullYear();
	const month = currentDate.getMonth();
	const toast = useToast();

	const startDate = useMemo(() => {
		const date = new Date(year, month, 1);
		return date.toISOString().split("T")[0]!;
	}, [year, month]);

	const endDate = useMemo(() => {
		const date = new Date(year, month + 1, 0);
		return date.toISOString().split("T")[0]!;
	}, [year, month]);

	const goToPreviousMonth = () => {
		setCurrentDate(new Date(year, month - 1, 1));
	};

	const goToNextMonth = () => {
		setCurrentDate(new Date(year, month + 1, 1));
	};

	const monthName = new Date(year, month, 1).toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});

	const { data: activities = initialActivities } =
		api.calendar.getActivities.useQuery(
			{ startDate, endDate },
			{ initialData: initialActivities },
		);

	const utils = api.useContext();
	const toggleMutation = api.calendar.toggleActivity.useMutation({
		onMutate: async (variables) => {
			await utils.calendar.getActivities.cancel({ startDate, endDate });
			const previousData = utils.calendar.getActivities.getData({
				startDate,
				endDate,
			});

			utils.calendar.getActivities.setData({ startDate, endDate }, (old) => {
				if (!old) return old;

				const existingIndex = old.findIndex(
					(item) => item.date === variables.date,
				);
				if (existingIndex !== -1) {
					const newData = [...old];
					const currentItem = newData[existingIndex] as ActivityData & Record<string, any>;
					const existingValue = currentItem?.[variables.activity] as number | undefined;
					newData[existingIndex] = {
						...newData[existingIndex],
						[variables.activity]: existingValue === 1 ? 0 : 1,
					} as ActivityData;
					return newData;
				}
				const newActivity: ActivityData = {
					date: variables.date,
					[variables.activity]: 1,
				};
				return [...old, newActivity];
			});

			return { previousData };
		},
		onSettled: () => {
			void utils.calendar.getActivities.invalidate({ startDate, endDate });
		},
	});

	const activityMaps = useMemo(() => {
		const maps: Record<string, Record<string, boolean>> = {};

		allActivityKeys.forEach((key) => {
			maps[key] = {};
		});

		activities.forEach((activity) => {
			allActivityKeys.forEach((key) => {
				const dateKey = activity.date as string;
				const val = (activity as any)[key] as number | undefined;
				const mapRecord = maps[key];
				if (mapRecord) {
					mapRecord[dateKey] = val === 1;
				}
			});
		});

		return maps;
	}, [activities]);

	const handleCalendarToggle = (
		calendarOptions: string[],
		date: string,
		currentState: string | null,
	) => {
		if (!currentState && calendarOptions.length > 0) {
			toggleMutation.mutate({ date, activity: calendarOptions[0]! });
		} else if (currentState) {
			const currentIndex = calendarOptions.indexOf(currentState);
			const nextIndex = (currentIndex + 1) % (calendarOptions.length + 1);

			toggleMutation.mutate({ date, activity: currentState });

			if (nextIndex < calendarOptions.length) {
				setTimeout(() => {
					toggleMutation.mutate({ date, activity: calendarOptions[nextIndex]! });
				}, 50);
			}
		}
	};

	return (
		<div
			className="overflow-x-auto min-h-screen"
			style={{ backgroundColor: "#1e1e1e" }}
		>
			<div className="inline-flex flex-col gap-2">
				<div className="flex justify-center items-center gap-2">
					<div className="text-sm text-gray-300 font-semibold">{monthName}</div>
					<button
						onClick={() =>
							utils.calendar.getActivities.invalidate({ startDate, endDate })
						}
						className="text-gray-400 hover:text-gray-200"
						title="Refresh"
					>
						<MdRefresh size={14} />
					</button>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={goToPreviousMonth}
						className="text-gray-400 hover:text-gray-200"
					>
						<MdChevronLeft size={28} />
					</button>
					<div className="flex gap-4 shrink-0">
						{calendarsConfig.map((config, idx) => (
							<MultiOptionCalendar
								key={idx}
								year={year}
								month={month}
								title={config.title}
								options={config.options}
								activityData={activityMaps}
								onToggle={(date, currentState) =>
									handleCalendarToggle(
										config.options.map((opt) => opt.key),
										date,
										currentState,
									)
								}
							/>
						))}
					</div>
					<button
						onClick={goToNextMonth}
						className="text-gray-400 hover:text-gray-200"
					>
						<MdChevronRight size={28} />
					</button>
				</div>
			</div>
		</div>
	);
}

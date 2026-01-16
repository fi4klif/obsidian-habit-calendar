import { useState, useMemo } from "react";
import { MultiOptionCalendar } from "./MultiOptionCalendar";
import { api } from "~/utils/api";
import { useToast } from "~/hooks/useToast";
import { MdRefresh, MdChevronLeft, MdChevronRight } from "react-icons/md";
import { calendarsConfig, allActivityKeys } from "~/config/calendars";

interface CalendarPageProps {
	initialActivities: any[];
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
					(item: any) => item.date === variables.date,
				);
				if (existingIndex !== -1) {
					const newData = [...old];
					newData[existingIndex] = {
						...newData[existingIndex],
						[variables.activity]:
							newData[existingIndex][variables.activity] === 1 ? 0 : 1,
					};
					return newData;
				} else {
					const newActivity: Record<string, string | number> = {
						date: variables.date,
						[variables.activity]: 1,
					};
					return [...old, newActivity];
				}
			});

			return { previousData };
		},
		onError: (error, variables, context) => {
			if (context?.previousData) {
				utils.calendar.getActivities.setData(
					{ startDate, endDate },
					context.previousData,
				);
			}
			toast.error("Failed to update activity", { position: "top-left" });
		},
		onSettled: () => {
			utils.calendar.getActivities.invalidate({ startDate, endDate });
		},
	});

	const activityMaps = useMemo(() => {
		const maps: Record<string, Record<string, boolean>> = {};

		allActivityKeys.forEach((key) => {
			maps[key] = {};
		});

		activities.forEach((activity: any) => {
			allActivityKeys.forEach((key) => {
				maps[key][activity.date] = activity[key] === 1;
			});
		});

		return maps;
	}, [activities]);

	const handleCalendarToggle = (
		calendarOptions: string[],
		date: string,
		currentState: string | null,
	) => {
		if (!currentState) {
			toggleMutation.mutate({ date, activity: calendarOptions[0] });
		} else {
			const currentIndex = calendarOptions.indexOf(currentState);
			const nextIndex = (currentIndex + 1) % (calendarOptions.length + 1);

			toggleMutation.mutate({ date, activity: currentState });

			if (nextIndex < calendarOptions.length) {
				setTimeout(() => {
					toggleMutation.mutate({ date, activity: calendarOptions[nextIndex] });
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
